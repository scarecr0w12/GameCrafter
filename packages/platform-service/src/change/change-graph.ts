import path from 'node:path';
import {
  uuidv7,
  type CanonRecord,
  type ChangeEdge,
  type ChangeNode,
  type ChangeNodeKind,
  type ChangeNodeRef,
  type ImpactNode,
  type ImpactResult,
  type TaskRecord,
  type ToolCallRecord,
} from '@gamecrafter/contracts';
import { readProjectTextFile, walkProjectFiles } from '../knowledge/knowledge-indexer';
import { ChangeGraphStore } from './change-graph-store';

export interface ChangeGraphSourcePort {
  projectPath(projectId: string): string;
  canonRecords(projectId: string): CanonRecord[];
  tasks(projectId: string): TaskRecord[];
  toolCalls(projectId: string): ToolCallRecord[];
}

export interface ChangeGraphOptions {
  storeForProject(projectId: string): ChangeGraphStore;
  sources: ChangeGraphSourcePort;
  now?: () => Date;
  onRebuildError?: (projectId: string, error: unknown) => void;
}

export interface ChangeGraphListOptions {
  kinds?: ChangeNodeKind[];
  limit?: number;
}

export interface ImpactOptions {
  maxDepth?: number;
  threshold?: number;
}

export class ChangeGraph {
  private readonly now: () => Date;
  private readonly pendingRebuilds = new Map<string, NodeJS.Timeout>();
  private stopped = false;

  constructor(private readonly options: ChangeGraphOptions) {
    this.now = options.now ?? (() => new Date());
  }

  scheduleRebuild(projectId: string): void {
    if (this.stopped) return;
    const previous = this.pendingRebuilds.get(projectId);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      this.pendingRebuilds.delete(projectId);
      try {
        this.rebuildGraph(projectId);
      } catch (error) {
        this.options.onRebuildError?.(projectId, error);
      }
    }, 100);
    timer.unref();
    this.pendingRebuilds.set(projectId, timer);
  }

  stop(): void {
    this.stopped = true;
    for (const timer of this.pendingRebuilds.values()) clearTimeout(timer);
    this.pendingRebuilds.clear();
  }

  graph(
    projectId: string,
    options: ChangeGraphListOptions = {},
  ): {
    nodes: ChangeNode[];
    edges: ChangeEdge[];
  } {
    const store = this.options.storeForProject(projectId);
    const nodes = store.nodes(projectId, options.kinds, options.limit);
    const nodeIds = new Set(nodes.map((node) => node.nodeId));
    const edges = store
      .edges(
        projectId,
        options.limit === undefined ? 5_000 : Math.max(options.limit * 4, options.limit),
      )
      .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to));
    return { nodes, edges };
  }

  impact(projectId: string, seeds: ChangeNodeRef[], options: ImpactOptions = {}): ImpactResult {
    const store = this.options.storeForProject(projectId);
    return calculateImpact(
      projectId,
      seeds,
      store.nodes(projectId, undefined, Number.MAX_SAFE_INTEGER),
      store.edges(projectId, Number.MAX_SAFE_INTEGER),
      {
        maxDepth: options.maxDepth ?? 4,
        threshold: options.threshold ?? 0.7,
        now: this.now,
      },
    );
  }

  rebuildGraph(projectId: string): { nodes: number; edges: number } {
    const now = this.now().toISOString();
    const nodes = new Map<string, ChangeNode>();
    const edges = new Map<string, ChangeEdge>();
    const ensureNode = (nodeId: string, title = nodeId): ChangeNode => {
      const existing = nodes.get(nodeId);
      if (existing) return existing;
      const colon = nodeId.indexOf(':');
      const kind = nodeId.slice(0, colon) as ChangeNodeKind;
      const node: ChangeNode = {
        schemaVersion: 1,
        nodeId,
        projectId,
        kind,
        ref: nodeId.slice(colon + 1),
        title,
        lastSeenAt: now,
      };
      nodes.set(nodeId, node);
      return node;
    };
    const addEdge = (
      from: string,
      to: string,
      rel: string,
      confidence: number,
      source: ChangeEdge['source'],
      evidence: string | null,
    ): void => {
      ensureNode(from);
      ensureNode(to);
      const key = `${from}\0${to}\0${rel}\0${source}`;
      if (edges.has(key)) return;
      edges.set(key, {
        edgeId: uuidv7(),
        projectId,
        from,
        to,
        rel,
        confidence,
        source,
        evidence,
        createdAt: now,
      });
    };

    const records = this.options.sources.canonRecords(projectId);
    const recordIds = new Set(records.map((record) => record.id));
    for (const record of records) {
      const from = `canon:${record.id}`;
      ensureNode(from, record.title);
      const decisionRecord =
        record.type === 'decision' ||
        record.provenance.some((provenance) => provenance.kind === 'decision');
      for (const reference of record.references) {
        if (!recordIds.has(reference.target) || reference.source === 'inferred') continue;
        addEdge(
          from,
          `canon:${reference.target}`,
          reference.rel,
          1,
          decisionRecord || reference.source === 'decision' ? 'decision' : 'author',
          `Canon reference from ${record.id}`,
        );
      }
    }

    for (const task of this.options.sources.tasks(projectId)) {
      const taskNode = `task:${task.taskId}`;
      ensureNode(taskNode, task.title);
      for (const touch of task.touches ?? []) {
        addEdge(
          taskNode,
          touch.resource,
          `touches-${touch.intent}`,
          0.9,
          'task',
          `Task ${task.taskId} declares ${touch.intent}`,
        );
      }
      for (const artifact of task.result?.artifacts ?? []) {
        const ref = artifact.path ?? artifact.uri;
        if (!ref) continue;
        const kind = artifact.kind === 'asset' ? 'asset' : 'file';
        addEdge(taskNode, `${kind}:${ref}`, 'produced', 0.9, 'task', artifact.hash ?? ref);
      }
    }

    for (const call of this.options.sources.toolCalls(projectId)) {
      if (!call.taskId || call.status !== 'completed') continue;
      const taskNode = `task:${call.taskId}`;
      const args = asRecord(call.input);
      const resourceRefs = toolCallResources(call);
      for (const resource of resourceRefs) {
        const write = isWriteTool(call.toolId);
        addEdge(
          taskNode,
          resource.ref,
          `tool-${write ? 'write' : 'read'}`,
          write ? 0.7 : 0.4,
          'tool',
          `Tool call ${call.callId}: ${call.toolId}`,
        );
      }
      const sessionId =
        stringValue(args.connectionId) ?? stringValue(asRecord(args.params).connectionId);
      if (sessionId && call.toolId.startsWith('engine/')) {
        addEdge(taskNode, `engine-session:${sessionId}`, 'used-session', 0.7, 'tool', call.callId);
      }
      if (call.toolId.startsWith('dcc/')) {
        const tool = stringValue(args.tool);
        if (tool)
          addEdge(taskNode, `dcc-session:${tool}`, 'used-session', 0.7, 'tool', call.callId);
      }
    }

    const canonIds = new Set(records.map((record) => record.id));
    const projectPath = this.options.sources.projectPath(projectId);
    for (const file of walkProjectFiles(projectPath)) {
      const text = readProjectTextFile(file.absolutePath);
      if (text === null) continue;
      const extension = path.extname(file.path).slice(1).toLowerCase();
      const scene = ['tscn', 'unity', 'umap'].includes(extension);
      const fileNode = scene ? `scene:${file.path}` : `file:${file.path}`;
      ensureNode(fileNode, path.basename(file.path));
      for (const match of text.matchAll(/\b[a-z]+\.[a-z0-9-]+\b/g)) {
        if (!canonIds.has(match[0]!)) continue;
        addEdge(fileNode, `canon:${match[0]}`, 'mentions', 0.5, 'inferred', match[0]!);
      }
      if (!scene) continue;
      for (const match of text.matchAll(/(?:res:\/\/|Assets\/|\/Game\/)([^"'\s)]+)/g)) {
        const assetPath = `${match[0]!.startsWith('res://') ? 'res://' : match[0]!.startsWith('/Game/') ? '/Game/' : 'Assets/'}${match[1]!}`;
        addEdge(fileNode, `asset:${assetPath}`, 'references-asset', 0.6, 'inferred', match[0]!);
      }
    }

    const nodeList = [...nodes.values()];
    const edgeList = [...edges.values()];
    this.options.storeForProject(projectId).replaceGraph(projectId, nodeList, edgeList);
    return { nodes: nodeList.length, edges: edgeList.length };
  }
}

export function calculateImpact(
  projectId: string,
  seeds: ChangeNodeRef[],
  nodes: ChangeNode[],
  edges: ChangeEdge[],
  options: { maxDepth: number; threshold: number; now: () => Date },
): ImpactResult {
  const nodeMap = new Map(nodes.map((node) => [node.nodeId, node]));
  const adjacency = new Map<string, Array<{ nodeId: string; edge: ChangeEdge }>>();
  for (const edge of edges) {
    adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), { nodeId: edge.to, edge }]);
    adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), { nodeId: edge.from, edge }]);
  }

  const best = new Map<string, ImpactNode>();
  const queue: ImpactNode[] = [];
  for (const seed of seeds) {
    const node = nodeMap.get(seed) ?? syntheticNode(projectId, seed, options.now().toISOString());
    const impactNode: ImpactNode = {
      node,
      depth: 0,
      pathConfidence: 1,
      via: [],
      needsValidation: false,
    };
    const current = best.get(seed);
    if (!current || current.pathConfidence < 1) {
      best.set(seed, impactNode);
      queue.push(impactNode);
    }
  }

  let truncated = false;
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current.depth >= options.maxDepth) {
      if ((adjacency.get(current.node.nodeId) ?? []).length > 0) truncated = true;
      continue;
    }
    for (const candidate of adjacency.get(current.node.nodeId) ?? []) {
      const pathConfidence = current.pathConfidence * candidate.edge.confidence;
      if (pathConfidence < 0.05) {
        truncated = true;
        continue;
      }
      const depth = current.depth + 1;
      const previous = best.get(candidate.nodeId);
      if (previous && previous.pathConfidence >= pathConfidence && previous.depth <= depth)
        continue;
      const candidateNode =
        nodeMap.get(candidate.nodeId) ??
        syntheticNode(projectId, candidate.nodeId as ChangeNodeRef, options.now().toISOString());
      const reached: ImpactNode = {
        node: candidateNode,
        depth,
        pathConfidence,
        via: [...current.via, candidate.edge.edgeId],
        needsValidation: pathConfidence < options.threshold,
      };
      best.set(candidate.nodeId, reached);
      queue.push(reached);
    }
  }

  return {
    seeds,
    threshold: options.threshold,
    nodes: [...best.values()].sort(
      (left, right) =>
        left.depth - right.depth || left.node.nodeId.localeCompare(right.node.nodeId),
    ),
    truncated,
  };
}

function syntheticNode(projectId: string, nodeRef: string, lastSeenAt: string): ChangeNode {
  const separator = nodeRef.indexOf(':');
  return {
    schemaVersion: 1,
    nodeId: nodeRef,
    projectId,
    kind: nodeRef.slice(0, separator) as ChangeNodeKind,
    ref: nodeRef.slice(separator + 1),
    title: nodeRef.slice(separator + 1),
    lastSeenAt,
  };
}

function toolCallResources(call: ToolCallRecord): Array<{ ref: string }> {
  const refs = new Set<string>();
  const input = asRecord(call.input);
  if (call.toolId === 'fs/read-file' || call.toolId === 'fs/write-file') {
    const file = stringValue(input.path);
    if (file) refs.add(`file:${file}`);
  }
  if (call.toolId === 'asset/import') {
    const destination = stringValue(input.destination) ?? stringValue(input.path);
    if (destination) refs.add(`asset:${destination}`);
  }
  for (const evidence of call.evidence) {
    if (evidence.kind === 'file') refs.add(`file:${evidence.ref}`);
    else if (evidence.kind === 'asset') refs.add(`asset:${evidence.ref}`);
    else if (evidence.kind === 'scene') refs.add(`scene:${evidence.ref}`);
  }
  return [...refs].map((ref) => ({ ref }));
}

function isWriteTool(toolId: string): boolean {
  return (
    toolId === 'fs/write-file' ||
    toolId === 'asset/import' ||
    toolId.startsWith('engine/') ||
    toolId.startsWith('dcc/')
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
