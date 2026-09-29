import { createHash } from 'node:crypto';
import type { IndexSource, KnowledgeChunk } from '@gamecrafter/contracts';

export interface ChunkerOptions {
  maxChars?: number;
  overlapChars?: number;
  maxCodeLines?: number;
}

export interface ChunkInput {
  projectId: string;
  source: IndexSource;
  path: string;
  recordId: string | null;
  revision: string;
  text: string;
}

interface Segment {
  text: string;
  startLine: number;
  endLine: number;
  section: number;
}

export class Chunker {
  private readonly maxChars: number;
  private readonly overlapChars: number;
  private readonly maxCodeLines: number;

  constructor(options: ChunkerOptions = {}) {
    this.maxChars = Math.max(1, options.maxChars ?? 1200);
    this.overlapChars = Math.max(0, Math.min(options.overlapChars ?? 100, this.maxChars - 1));
    this.maxCodeLines = Math.max(1, options.maxCodeLines ?? 80);
  }

  chunk(input: ChunkInput): KnowledgeChunk[] {
    const segments = buildSegments(input, this.maxCodeLines);
    const isCode = input.source === 'code' || isCodePath(input.path);
    const chunks: KnowledgeChunk[] = [];
    let currentText = '';
    let currentStart = 0;
    let currentEnd = 0;
    let currentSection = -1;

    const emit = () => {
      const text = currentText.trim();
      if (!text) return;
      const chunkIndex = chunks.length;
      const chunkId = createHash('sha256')
        .update(`${input.projectId}\0${input.path}\0${input.revision}\0${chunkIndex}`)
        .digest('hex');
      chunks.push({
        chunkId,
        projectId: input.projectId,
        source: input.source,
        path: input.path,
        recordId: input.recordId,
        revision: input.revision,
        startLine: currentStart,
        endLine: currentEnd,
        text,
        tokensEstimate: Math.ceil(Buffer.byteLength(text, 'utf8') / 4),
      });
      currentText = '';
      currentStart = 0;
      currentEnd = 0;
    };

    for (const segment of segments) {
      if (currentText && segment.section !== currentSection) emit();
      const fragments = isCode ? [segment] : splitLongSegment(segment, this.maxChars);
      for (const fragment of fragments) {
        if (!currentText) {
          currentText = fragment.text;
          currentStart = fragment.startLine;
          currentEnd = fragment.endLine;
          currentSection = fragment.section;
          continue;
        }
        const combined = `${currentText}\n\n${fragment.text}`;
        if (combined.length <= this.maxChars) {
          currentText = combined;
          currentEnd = fragment.endLine;
          continue;
        }
        const previousText = currentText;
        const previousEnd = currentEnd;
        emit();
        const carry =
          fragment.section === currentSection && this.overlapChars > 0
            ? previousText.slice(-this.overlapChars)
            : '';
        currentText = carry ? `${carry}\n\n${fragment.text}` : fragment.text;
        currentStart = carry ? previousEnd : fragment.startLine;
        currentEnd = fragment.endLine;
        currentSection = fragment.section;
        if (!isCode && currentText.length > this.maxChars) {
          const overflow = splitLongSegment(
            { ...fragment, text: currentText, startLine: currentStart },
            this.maxChars,
          );
          currentText = overflow[0]?.text ?? currentText;
          currentStart = overflow[0]?.startLine ?? currentStart;
          currentEnd = overflow[0]?.endLine ?? currentEnd;
          for (const rest of overflow.slice(1)) {
            emit();
            currentText = rest.text;
            currentStart = rest.startLine;
            currentEnd = rest.endLine;
            currentSection = rest.section;
          }
        }
      }
    }
    emit();
    return chunks;
  }
}

function buildSegments(input: ChunkInput, maxCodeLines: number): Segment[] {
  const lines = input.text.replace(/\r\n?/g, '\n').split('\n');
  if (input.source === 'code' || isCodePath(input.path)) return codeSegments(lines, maxCodeLines);
  if (
    input.path.endsWith('.md') ||
    ['canon', 'decisions', 'docs', 'board'].includes(input.source)
  ) {
    return markdownSegments(lines);
  }
  return paragraphSegments(lines);
}

function markdownSegments(lines: string[]): Segment[] {
  const segments: Segment[] = [];
  let section = 0;
  let paragraph: string[] = [];
  let paragraphStart = 1;
  const flush = (endLine: number) => {
    const text = paragraph.join('\n').trim();
    if (text) segments.push({ text, startLine: paragraphStart, endLine, section });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (/^\s{0,3}#{1,6}\s/.test(line)) {
      if (paragraph.length > 0) flush(index);
      if (segments.length > 0) section += 1;
      paragraphStart = index + 1;
      paragraph = [line];
    } else if (!line.trim()) {
      if (paragraph.length > 0) flush(index);
      paragraphStart = index + 2;
    } else {
      if (paragraph.length === 0) paragraphStart = index + 1;
      paragraph.push(line);
    }
  }
  if (paragraph.length > 0) flush(lines.length);
  return segments;
}

function paragraphSegments(lines: string[]): Segment[] {
  const segments: Segment[] = [];
  let paragraph: string[] = [];
  let paragraphStart = 1;
  const flush = (endLine: number) => {
    const text = paragraph.join('\n').trim();
    if (text) segments.push({ text, startLine: paragraphStart, endLine, section: 0 });
    paragraph = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (!line.trim()) {
      if (paragraph.length > 0) flush(index);
      paragraphStart = index + 2;
    } else {
      if (paragraph.length === 0) paragraphStart = index + 1;
      paragraph.push(line);
    }
  }
  if (paragraph.length > 0) flush(lines.length);
  return segments;
}

function codeSegments(lines: string[], maxCodeLines: number): Segment[] {
  const segments: Segment[] = [];
  let block: string[] = [];
  let blockStart = 1;
  const flush = (endLine: number) => {
    const text = block.join('\n').trim();
    if (text) segments.push({ text, startLine: blockStart, endLine, section: 0 });
    block = [];
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const startsFunction =
      /^(?:\s*(?:export\s+)?(?:async\s+)?function\s+|\s*(?:public|private|protected|static)\s+\w+\s*\(|\s*func\s+|\s*(?:class|struct)\s+)/.test(
        line,
      );
    if (block.length > 0 && (startsFunction || !line.trim() || block.length >= maxCodeLines)) {
      flush(index);
      blockStart = index + 1;
    }
    if (!line.trim()) {
      blockStart = index + 2;
      continue;
    }
    if (block.length === 0) blockStart = index + 1;
    block.push(line);
    if (block.length >= maxCodeLines) flush(index + 1);
  }
  if (block.length > 0) flush(lines.length);
  return segments;
}

function splitLongSegment(segment: Segment, maxChars: number): Segment[] {
  if (segment.text.length <= maxChars) return [segment];
  const fragments: Segment[] = [];
  const lines = segment.text.split('\n');
  let lineNumber = segment.startLine;
  let currentText = '';
  let currentStart = lineNumber;
  const flush = (endLine: number) => {
    const text = currentText.trim();
    if (text) fragments.push({ text, startLine: currentStart, endLine, section: segment.section });
    currentText = '';
  };
  for (const line of lines) {
    if (line.length > maxChars) {
      if (currentText) flush(lineNumber - 1);
      for (let offset = 0; offset < line.length; offset += maxChars) {
        const part = line.slice(offset, offset + maxChars);
        fragments.push({
          text: part,
          startLine: lineNumber,
          endLine: lineNumber,
          section: segment.section,
        });
      }
      lineNumber += 1;
      currentStart = lineNumber;
      continue;
    }
    const next = currentText ? `${currentText}\n${line}` : line;
    if (currentText && next.length > maxChars) {
      flush(lineNumber - 1);
      currentStart = lineNumber;
      currentText = line;
    } else {
      currentText = next;
    }
    lineNumber += 1;
  }
  if (currentText) flush(lineNumber - 1);
  return fragments;
}

function isCodePath(filePath: string): boolean {
  return /\.(?:cs|cpp|h|hpp|gd|py|ts|js|shader|hlsl|glsl|usf|ush)$/i.test(filePath);
}
