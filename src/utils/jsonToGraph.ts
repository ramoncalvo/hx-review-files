import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

export type JsonValue =
  | string | number | boolean | null
  | { [key: string]: JsonValue }
  | JsonValue[];

interface NodeData extends Record<string, unknown> {
  label: string;
  entries: { key: string; value: JsonValue; isRef: boolean }[];
  nodeType: 'root' | 'object' | 'array';
  size: number;
  path: string[]; // full key path from root, e.g. ['organization', 'billing']
}

let idCounter = 0;
const nextId = () => `n${idCounter++}`;

function typeOf(v: JsonValue): 'object' | 'array' | 'primitive' {
  if (v === null) return 'primitive';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') return 'object';
  return 'primitive';
}

function buildGraph(
  value: JsonValue,
  parentId: string | null,
  edgeLabel: string,
  nodes: Node<NodeData>[],
  edges: Edge[],
  depth: number,
  path: string[] = []
): string {
  const id = nextId();
  const kind = typeOf(value);

  if (kind === 'primitive') {
    const isRoot = parentId === null;
    nodes.push({
      id,
      type: 'jsonNode',
      position: { x: 0, y: 0 },
      data: {
        label: isRoot ? 'root' : edgeLabel,
        entries: [{ key: '', value, isRef: false }],
        nodeType: isRoot ? 'root' : 'object',
        size: 1,
        path,
      },
    });
    if (parentId) {
      edges.push({
        id: `e${parentId}-${id}`,
        source: parentId,
        target: id,
        label: edgeLabel,
        animated: depth < 2,
      });
    }
    return id;
  }

  // Object or Array node — collect direct primitive children inline,
  // recurse complex children as linked nodes.
  const isRoot = parentId === null;
  const nodeType: NodeData['nodeType'] = isRoot ? 'root' : kind === 'array' ? 'array' : 'object';
  const entries: NodeData['entries'] = [];
  const complexChildren: { key: string; value: JsonValue }[] = [];

  const kvPairs: [string, JsonValue][] =
    kind === 'array'
      ? (value as JsonValue[]).map((v, i) => [String(i), v])
      : Object.entries(value as { [k: string]: JsonValue });

  for (const [k, v] of kvPairs) {
    if (typeOf(v) === 'primitive') {
      entries.push({ key: k, value: v, isRef: false });
    } else {
      entries.push({ key: k, value: v, isRef: true });
      complexChildren.push({ key: k, value: v });
    }
  }

  nodes.push({
    id,
    type: 'jsonNode',
    position: { x: 0, y: 0 },
    data: {
      label: isRoot ? 'root' : edgeLabel,
      entries,
      nodeType,
      size: kvPairs.length,
      path,
    },
  });

  if (parentId) {
    edges.push({
      id: `e${parentId}-${id}`,
      source: parentId,
      target: id,
      label: edgeLabel,
      animated: depth < 2,
    });
  }

  for (const child of complexChildren) {
    buildGraph(child.value, id, child.key, nodes, edges, depth + 1, [...path, child.key]);
  }

  return id;
}

const NODE_WIDTH = 240;
const NODE_HEIGHT_BASE = 38; // header
const NODE_HEIGHT_PER_ROW = 22;
const NODE_HEIGHT_FOOTER = 18;

function estimateHeight(data: NodeData): number {
  return (
    NODE_HEIGHT_BASE +
    data.entries.length * NODE_HEIGHT_PER_ROW +
    NODE_HEIGHT_FOOTER
  );
}

export function jsonToGraph(json: JsonValue): { nodes: Node<NodeData>[]; edges: Edge[] } {
  idCounter = 0;
  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];

  buildGraph(json, null, 'root', nodes, edges, 0);

  // Layout with dagre
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 60, nodesep: 20, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    const h = estimateHeight(node.data);
    g.setNode(node.id, { width: NODE_WIDTH, height: h });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positionedNodes = nodes.map((node) => {
    const { x, y } = g.node(node.id);
    const h = estimateHeight(node.data);
    return {
      ...node,
      position: { x: x - NODE_WIDTH / 2, y: y - h / 2 },
    };
  });

  return { nodes: positionedNodes, edges };
}

export type { NodeData };
