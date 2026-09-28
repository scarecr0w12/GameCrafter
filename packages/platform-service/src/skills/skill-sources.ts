import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { RpcError, RpcErrorCode } from '@gamecrafter/contracts';

export type SkillSource =
  | { kind: 'local'; path: string }
  | { kind: 'git'; url: string; ref?: string; subpath?: string }
  | { kind: 'archive-url'; url: string }
  | { kind: 'skill-md-url'; url: string }
  | { kind: 'skills-sh-pack'; id: string };

export function resolveSource(input: string): SkillSource {
  const source = input.trim();
  if (!source) throw unsupported('Skill source cannot be empty.');

  if (source.startsWith('git@')) return { kind: 'git', url: source };

  const shorthand = source.match(/^([^/]+)\/([^/]+)$/);
  if (shorthand) {
    return { kind: 'git', url: `https://github.com/${shorthand[1]}/${shorthand[2]}.git` };
  }
  if (source.startsWith('file://')) {
    const localPath = path.resolve(fileURLToPath(source));
    return path.basename(localPath).endsWith('.git')
      ? { kind: 'git', url: source }
      : { kind: 'local', path: localPath };
  }
  if (existsSync(source) || isLocalPath(source)) {
    return { kind: 'local', path: path.resolve(source) };
  }

  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    if (source.includes('/')) return { kind: 'local', path: path.resolve(source) };
    throw unsupported(`Unsupported skill source: ${source}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.protocol !== 'ssh:') {
    throw unsupported(`Unsupported skill source protocol: ${parsed.protocol}`);
  }

  if (parsed.hostname.toLowerCase() === 'skills.sh' && parsed.pathname.startsWith('/p/')) {
    const id = decodeURIComponent(parsed.pathname.slice('/p/'.length)).replace(/\/$/, '');
    return { kind: 'skills-sh-pack', id };
  }
  if (/\.zip$/i.test(parsed.pathname))
    throw unsupported('The .zip skill archive format is not supported.');
  if (/\.(?:tar\.gz|tgz)$/i.test(parsed.pathname)) {
    return { kind: 'archive-url', url: source };
  }
  if (/\/SKILL\.md$/i.test(parsed.pathname)) {
    return { kind: 'skill-md-url', url: source };
  }

  const treeSource = parseTreeUrl(parsed);
  if (treeSource) return treeSource;

  const gitUrl = new URL(parsed.href);
  const refFromHash = gitUrl.hash.length > 1 ? decodeURIComponent(gitUrl.hash.slice(1)) : undefined;
  gitUrl.hash = '';
  const refFromQuery = gitUrl.searchParams.get('ref') ?? undefined;
  if (/\.git\/?$/i.test(gitUrl.pathname)) {
    if (refFromQuery) gitUrl.searchParams.delete('ref');
    return {
      kind: 'git',
      url: gitUrl.toString(),
      ...((refFromHash ?? refFromQuery) ? { ref: refFromHash ?? refFromQuery } : {}),
    };
  }

  if (isRepositoryRoot(gitUrl)) {
    gitUrl.pathname = `${gitUrl.pathname.replace(/\/$/, '')}.git`;
    return { kind: 'git', url: gitUrl.toString() };
  }

  throw unsupported(`Unsupported skill source URL: ${source}`);
}

function parseTreeUrl(url: URL): SkillSource | undefined {
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  let repositorySegments: string[] | undefined;
  let treeIndex = -1;
  if (url.hostname.toLowerCase() === 'github.com' && segments[2] === 'tree') {
    repositorySegments = segments.slice(0, 2);
    treeIndex = 2;
  } else {
    const separatorIndex = segments.indexOf('-');
    if (separatorIndex > 1 && segments[separatorIndex + 1] === 'tree') {
      repositorySegments = segments.slice(0, separatorIndex);
      treeIndex = separatorIndex + 1;
    }
  }
  if (!repositorySegments || segments.length <= treeIndex + 1) return undefined;
  const ref = segments[treeIndex + 1];
  const subpath = segments.slice(treeIndex + 2).join('/');
  const cloneUrl = new URL(url.origin);
  cloneUrl.pathname = `${repositorySegments.join('/')}.git`;
  cloneUrl.search = '';
  cloneUrl.hash = '';
  return { kind: 'git', url: cloneUrl.toString(), ref, ...(subpath ? { subpath } : {}) };
}

function isRepositoryRoot(url: URL): boolean {
  const segments = url.pathname.split('/').filter(Boolean);
  const host = url.hostname.toLowerCase();
  if (host === 'github.com') return segments.length === 2;
  if (host === 'gitlab.com') return segments.length >= 2 && !segments.includes('-');
  return host === 'dev.azure.com' && segments.includes('_git');
}

function isLocalPath(source: string): boolean {
  return (
    path.isAbsolute(source) ||
    source.startsWith(`.${path.sep}`) ||
    source === '.' ||
    source === '..' ||
    source.startsWith(`..${path.sep}`)
  );
}

function unsupported(message: string): RpcError {
  return new RpcError(message, RpcErrorCode.SkillSourceUnsupported);
}
