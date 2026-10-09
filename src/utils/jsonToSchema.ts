import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

// ── Schema types ─────────────────────────────────────────────────

export type PrimType = 'string' | 'number' | 'boolean' | 'null';

export type SchemaNode =
  | { kind: 'primitive'; type: PrimType }
  | { kind: 'mixed';     types: string[] }
  | { kind: 'object';    props: Record<string, SchemaNode>; optional?: Set<string> }
  | { kind: 'array';     count: number; items: SchemaNode };

// ── Infer schema from a value ─────────────────────────────────────

export function inferSchema(value: unknown): SchemaNode {
  if (value === null)              return { kind: 'primitive', type: 'null' };
  if (typeof value === 'boolean')  return { kind: 'primitive', type: 'boolean' };
  if (typeof value === 'number')   return { kind: 'primitive', type: 'number' };
  if (typeof value === 'string')   return { kind: 'primitive', type: 'string' };

  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: 'array', count: 0, items: { kind: 'primitive', type: 'null' } };
    // Sample up to 50 items for performance
    const sample = value.length > 50 ? value.slice(0, 50) : value;
    const schemas = sample.map(inferSchema);
    const merged = schemas.reduce(mergeSchema);
    return { kind: 'array', count: value.length, items: merged };
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const props: Record<string, SchemaNode> = {};
    for (const [k, v] of Object.entries(obj)) {
      props[k] = inferSchema(v);
    }
    return { kind: 'object', props };
  }

  return { kind: 'primitive', type: 'string' };
}

function mergeSchema(a: SchemaNode, b: SchemaNode): SchemaNode {
  if (a.kind === 'primitive' && b.kind === 'primitive') {
    if (a.type === b.type) return a;
    return { kind: 'mixed', types: [...new Set([a.type, b.type])] };
  }
  if (a.kind === 'mixed' && b.kind === 'primitive') {
    return { kind: 'mixed', types: [...new Set([...a.types, b.type])] };
  }
  if (a.kind === 'primitive' && b.kind === 'mixed') {
    return { kind: 'mixed', types: [...new Set([a.type, ...b.types])] };
  }
  if (a.kind === 'mixed' && b.kind === 'mixed') {
    return { kind: 'mixed', types: [...new Set([...a.types, ...b.types])] };
  }
  if (a.kind === 'array' && b.kind === 'array') {
    return { kind: 'array', count: Math.max(a.count, b.count), items: mergeSchema(a.items, b.items) };
  }
  if (a.kind === 'object' && b.kind === 'object') {
    const allKeys = new Set([...Object.keys(a.props), ...Object.keys(b.props)]);
    const optional = new Set<string>();
    const props: Record<string, SchemaNode> = {};
    for (const k of allKeys) {
      if (!(k in a.props)) { optional.add(k); props[k] = b.props[k]; }
      else if (!(k in b.props)) { optional.add(k); props[k] = a.props[k]; }
      else props[k] = mergeSchema(a.props[k], b.props[k]);
    }
    return { kind: 'object', props, optional };
  }
  // Incompatible kinds → mixed
  return { kind: 'mixed', types: [a.kind, b.kind] };
}

// ── Format schema as inline text (for array item summary) ─────────

export function schemaToInline(schema: SchemaNode, depth = 0): string {
  if (depth > 3) return '…';
  switch (schema.kind) {
    case 'primitive': return schema.type;
    case 'mixed':     return schema.types.join(' | ');
    case 'array':     return `array[${schema.count}]`;
    case 'object': {
      const entries = Object.entries(schema.props).slice(0, 6).map(([k, v]) => {
        const opt = schema.optional?.has(k) ? '?' : '';
        return `${k}${opt}: ${schemaToInline(v, depth + 1)}`;
      });
      const more = Object.keys(schema.props).length > 6
        ? ` +${Object.keys(schema.props).length - 6} more`
        : '';
      return `{ ${entries.join(', ')}${more} }`;
    }
  }
}

// ── NodeData for schema graph ─────────────────────────────────────

export interface SchemaNodeData extends Record<string, unknown> {
  label: string;
  nodeKind: 'object' | 'array' | 'root';
  rows: SchemaRow[];
  path: string[];
}

export interface SchemaRow {
  key: string;
  typeLabel: string;
  isRef: boolean;   // has a child node
  optional: boolean;
}

// ── Build graph from schema ───────────────────────────────────────

let idCounter = 0;
const nextId = () => `s${idCounter++}`;

function buildSchemaGraph(
  schema: SchemaNode,
  parentId: string | null,
  label: string,
  nodes: Node<SchemaNodeData>[],
  edges: Edge[],
  path: string[],
  depth: number
): string {
  const id = nextId();

  // Primitives / mixed at root level → single node
  if (schema.kind === 'primitive' || schema.kind === 'mixed') {
    nodes.push({
      id, type: 'schemaNode', position: { x: 0, y: 0 },
      data: {
        label,
        nodeKind: 'object',
        rows: [{ key: '', typeLabel: schemaToInline(schema), isRef: false, optional: false }],
        path,
      },
    });
    if (parentId) edges.push({ id: `e${parentId}-${id}`, source: parentId, target: id, label });
    return id;
  }

  if (schema.kind === 'array') {
    const rows: SchemaRow[] = [];
    rows.push({ key: `Array[${schema.count}]`, typeLabel: '', isRef: false, optional: false });

    // If items are objects, show each property as a row
    if (schema.items.kind === 'object') {
      for (const [k, v] of Object.entries(schema.items.props)) {
        const opt = schema.items.optional?.has(k) ?? false;
        const isRef = v.kind === 'object' || v.kind === 'array';
        rows.push({ key: k, typeLabel: schemaToInline(v), isRef, optional: opt });
      }
    } else {
      rows.push({ key: 'items', typeLabel: schemaToInline(schema.items), isRef: false, optional: false });
    }

    nodes.push({
      id, type: 'schemaNode', position: { x: 0, y: 0 },
      data: { label, nodeKind: 'array', rows, path },
    });
    if (parentId) edges.push({ id: `e${parentId}-${id}`, source: parentId, target: id, label });

    // Only recurse into object item properties that are themselves complex AND depth allows
    if (schema.items.kind === 'object' && depth < 6) {
      for (const [k, v] of Object.entries(schema.items.props)) {
        if (v.kind === 'object' || v.kind === 'array') {
          buildSchemaGraph(v, id, k, nodes, edges, [...path, k], depth + 1);
        }
      }
    }
    return id;
  }

  // Object node
  const rows: SchemaRow[] = [];
  const complexChildren: { key: string; schema: SchemaNode }[] = [];

  for (const [k, v] of Object.entries(schema.props)) {
    const opt = schema.optional?.has(k) ?? false;
    if (v.kind === 'object' || v.kind === 'array') {
      rows.push({ key: k, typeLabel: v.kind === 'array' ? `array[${v.count}]` : 'object', isRef: true, optional: opt });
      complexChildren.push({ key: k, schema: v });
    } else {
      rows.push({ key: k, typeLabel: schemaToInline(v), isRef: false, optional: opt });
    }
  }

  const isRoot = parentId === null;
  nodes.push({
    id, type: 'schemaNode', position: { x: 0, y: 0 },
    data: { label, nodeKind: isRoot ? 'root' : 'object', rows, path },
  });
  if (parentId) edges.push({ id: `e${parentId}-${id}`, source: parentId, target: id, label });

  if (depth < 8) {
    for (const child of complexChildren) {
      buildSchemaGraph(child.schema, id, child.key, nodes, edges, [...path, child.key], depth + 1);
    }
  }

  return id;
}

const NODE_WIDTH = 280;
const ROW_H = 22;
const HEADER_H = 38;
const FOOTER_H = 18;

function estH(rows: number) { return HEADER_H + rows * ROW_H + FOOTER_H; }

export function jsonToSchemaGraph(json: unknown): { nodes: Node<SchemaNodeData>[]; edges: Edge[] } {
  idCounter = 0;
  const nodes: Node<SchemaNodeData>[] = [];
  const edges: Edge[] = [];

  const schema = inferSchema(json);
  buildSchemaGraph(schema, null, 'root', nodes, edges, [], 0);

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 70, nodesep: 24, marginx: 40, marginy: 40 });

  for (const node of nodes) {
    const h = estH(node.data.rows.length);
    g.setNode(node.id, { width: NODE_WIDTH, height: h });
  }
  for (const edge of edges) g.setEdge(edge.source, edge.target);

  dagre.layout(g);

  return {
    nodes: nodes.map(n => {
      const { x, y } = g.node(n.id);
      const h = estH(n.data.rows.length);
      return { ...n, position: { x: x - NODE_WIDTH / 2, y: y - h / 2 } };
    }),
    edges,
  };
}
