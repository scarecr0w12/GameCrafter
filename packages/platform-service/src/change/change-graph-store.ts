import type { ChangeEdge, ChangeNode, ChangeNodeKind } from '@gamecrafter/contracts';
import type { Database } from '../db/database';

interface ChangeNodeRow {
  nodeId: string;
  projectId: string;
  kind: ChangeNodeKind;
  ref: string;
  title: string;
  lastSeenAt: string;
}

interface ChangeEdgeRow {
  edgeId: string;
  projectId: string;
  fromNode: string;
  toNode: string;
  rel: string;
  confidence: number;
  source: ChangeEdge['source'];
  evidence: string | null;
  createdAt: string;
}

export class ChangeGraphStore {
  constructor(private readonly database: Database) {}

  nodes(projectId: string, kinds?: ChangeNodeKind[], limit = 1_000): ChangeNode[] {
    if (kinds && kinds.length === 0) return [];
    const kindFilter = kinds ? `AND kind IN (${kinds.map(() => '?').join(', ')})` : '';
    const rows = this.database
      .prepare(
        `SELECT node_id AS nodeId, project_id AS projectId, kind, ref, title,
          last_seen_at AS lastSeenAt
         FROM change_nodes WHERE project_id = ? ${kindFilter}
         ORDER BY kind, node_id LIMIT ?`,
      )
      .all<ChangeNodeRow>(projectId, ...(kinds ?? []), limit);
    return rows.map((row) => ({ schemaVersion: 1, ...row }));
  }

  edges(projectId: string, limit = 5_000): ChangeEdge[] {
    const rows = this.database
      .prepare(
        `SELECT edge_id AS edgeId, project_id AS projectId, from_node AS fromNode,
          to_node AS toNode, rel, confidence, source, evidence, created_at AS createdAt
         FROM change_edges WHERE project_id = ?
         ORDER BY from_node, to_node, rel, source LIMIT ?`,
      )
      .all<ChangeEdgeRow>(projectId, limit);
    return rows.map((row) => ({
      edgeId: row.edgeId,
      projectId: row.projectId,
      from: row.fromNode,
      to: row.toNode,
      rel: row.rel,
      confidence: row.confidence,
      source: row.source,
      evidence: row.evidence,
      createdAt: row.createdAt,
    }));
  }

  replaceGraph(projectId: string, nodes: ChangeNode[], edges: ChangeEdge[]): void {
    this.database.transaction(() => {
      const nodeIds = new Set(nodes.map((node) => node.nodeId));
      for (const node of this.nodes(projectId, undefined, Number.MAX_SAFE_INTEGER)) {
        if (!nodeIds.has(node.nodeId)) {
          this.database
            .prepare('DELETE FROM change_nodes WHERE project_id = ? AND node_id = ?')
            .run(projectId, node.nodeId);
        }
      }

      const edgeKeys = new Set(edges.map(edgeKey));
      for (const edge of this.edges(projectId, Number.MAX_SAFE_INTEGER)) {
        if (!edgeKeys.has(edgeKey(edge))) {
          this.database.prepare('DELETE FROM change_edges WHERE edge_id = ?').run(edge.edgeId);
        }
      }

      for (const node of nodes) this.upsertNode(node);
      for (const edge of edges) this.upsertEdge(edge);
    });
  }

  upsertNode(node: ChangeNode): void {
    this.database
      .prepare(
        `INSERT INTO change_nodes (project_id, node_id, kind, ref, title, last_seen_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, node_id) DO UPDATE SET
          kind = excluded.kind,
          ref = excluded.ref,
          title = excluded.title,
          last_seen_at = excluded.last_seen_at`,
      )
      .run(node.projectId, node.nodeId, node.kind, node.ref, node.title, node.lastSeenAt);
  }

  upsertEdge(edge: ChangeEdge): void {
    this.database
      .prepare(
        `INSERT INTO change_edges
          (edge_id, project_id, from_node, to_node, rel, confidence, source, evidence, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(project_id, from_node, to_node, rel, source) DO UPDATE SET
          confidence = excluded.confidence,
          evidence = excluded.evidence,
          created_at = excluded.created_at`,
      )
      .run(
        edge.edgeId,
        edge.projectId,
        edge.from,
        edge.to,
        edge.rel,
        edge.confidence,
        edge.source,
        edge.evidence,
        edge.createdAt,
      );
  }
}

function edgeKey(edge: Pick<ChangeEdge, 'from' | 'to' | 'rel' | 'source'>): string {
  return `${edge.from}\0${edge.to}\0${edge.rel}\0${edge.source}`;
}
