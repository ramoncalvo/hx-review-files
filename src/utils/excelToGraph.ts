import * as XLSX from 'xlsx';
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';

export interface ColInfo {
  name: string;
  type: 'id' | 'fk' | 'string' | 'number' | 'date' | 'boolean';
  sample: string;
  isKey: boolean;   // participates in a detected relationship
}

export interface TableData extends Record<string, unknown> {
  tableName: string;
  fileName: string;
  columns: ColInfo[];
  rowCount: number;
  linkedCols: string[]; // column names that link to other tables
}

export interface Relation {
  fromTable: string;
  toTable: string;
  column: string; // shared column name
}

// ── Type inference ──────────────────────────────────────────────
function inferType(values: unknown[]): ColInfo['type'] {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  if (!nonNull.length) return 'string';

  const allNum = nonNull.every(v => !isNaN(Number(v)));
  if (allNum) return 'number';

  const dateRe = /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/;
  if (nonNull.every(v => dateRe.test(String(v)))) return 'date';

  const boolVals = new Set(['true','false','yes','no','1','0','si','sí']);
  if (nonNull.every(v => boolVals.has(String(v).toLowerCase()))) return 'boolean';

  return 'string';
}

function classifyCol(name: string, type: ColInfo['type']): ColInfo['type'] {
  const low = name.toLowerCase();
  if (low === 'id' || low.endsWith('_id') || low.endsWith('id')) {
    return low === 'id' ? 'id' : 'fk';
  }
  return type;
}

// ── Parse one file ───────────────────────────────────────────────
export interface ParsedTable {
  tableName: string;
  fileName: string;
  columns: ColInfo[];
  rowCount: number;
  rows: Record<string, unknown>[];
}

export async function parseExcelFile(file: File): Promise<ParsedTable[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });

  const tables: ParsedTable[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });

    if (!rows.length) continue;

    const colNames = Object.keys(rows[0]);
    const columns: ColInfo[] = colNames.map(name => {
      const values = rows.map(r => r[name]).slice(0, 100);
      const rawType = inferType(values);
      const type = classifyCol(name, rawType);
      const sample = String(values.find(v => v !== null && v !== undefined && v !== '') ?? '');
      return { name, type, sample: sample.slice(0, 40), isKey: false };
    });

    tables.push({
      tableName: sheetName,
      fileName: file.name,
      columns,
      rowCount: rows.length,
      rows,
    });
  }

  return tables;
}

// ── Detect relationships ─────────────────────────────────────────
export function detectRelations(tables: ParsedTable[]): Relation[] {
  const relations: Relation[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < tables.length; i++) {
    for (let j = 0; j < tables.length; j++) {
      if (i === j) continue;
      const a = tables[i];
      const b = tables[j];

      const aCols = new Set(a.columns.map(c => c.name.toLowerCase()));
      const bCols = new Set(b.columns.map(c => c.name.toLowerCase()));

      // Strategy 1: exact column name match (shared key)
      for (const col of aCols) {
        if (bCols.has(col)) {
          const key = [a.tableName, b.tableName, col].sort().join('|');
          if (!seen.has(key)) {
            seen.add(key);
            relations.push({ fromTable: a.tableName, toTable: b.tableName, column: col });
          }
        }
      }

      // Strategy 2: tableName_id or tableNameId in another table
      const tableBase = a.tableName.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const col of bCols) {
        const colBase = col.replace(/_/g, '').replace(/id$/, '');
        if (colBase === tableBase && col.toLowerCase().endsWith('id')) {
          const key = [a.tableName, b.tableName, col].sort().join('|');
          if (!seen.has(key)) {
            seen.add(key);
            relations.push({ fromTable: a.tableName, toTable: b.tableName, column: col });
          }
        }
      }
    }
  }

  return relations;
}

// ── Build React Flow graph ───────────────────────────────────────
const NODE_WIDTH = 260;
const NODE_HEIGHT_BASE = 44;
const NODE_HEIGHT_PER_COL = 22;
const NODE_HEIGHT_FOOTER = 18;

function estimateHeight(cols: number): number {
  return NODE_HEIGHT_BASE + cols * NODE_HEIGHT_PER_COL + NODE_HEIGHT_FOOTER;
}

export function buildExcelGraph(tables: ParsedTable[], relations: Relation[]): {
  nodes: Node<TableData>[];
  edges: Edge[];
} {
  // Mark linked columns
  const linkedMap = new Map<string, Set<string>>();
  for (const rel of relations) {
    if (!linkedMap.has(rel.fromTable)) linkedMap.set(rel.fromTable, new Set());
    if (!linkedMap.has(rel.toTable))   linkedMap.set(rel.toTable, new Set());
    linkedMap.get(rel.fromTable)!.add(rel.column.toLowerCase());
    linkedMap.get(rel.toTable)!.add(rel.column.toLowerCase());
  }

  const nodes: Node<TableData>[] = tables.map(t => {
    const linked = linkedMap.get(t.tableName) ?? new Set();
    const cols: ColInfo[] = t.columns.map(c => ({
      ...c,
      isKey: linked.has(c.name.toLowerCase()),
    }));
    return {
      id: t.tableName,
      type: 'tableNode',
      position: { x: 0, y: 0 },
      data: {
        tableName: t.tableName,
        fileName: t.fileName,
        columns: cols,
        rowCount: t.rowCount,
        linkedCols: Array.from(linked),
      },
    };
  });

  // Deduplicate edges (keep one per table pair + column)
  const edgeSeen = new Set<string>();
  const edges: Edge[] = [];
  for (const rel of relations) {
    const key = `${rel.fromTable}→${rel.toTable}::${rel.column}`;
    if (edgeSeen.has(key)) continue;
    edgeSeen.add(key);
    edges.push({
      id: key,
      source: rel.fromTable,
      target: rel.toTable,
      label: rel.column,
      type: 'smoothstep',
    });
  }

  // Dagre layout
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 30, marginx: 50, marginy: 50 });

  for (const node of nodes) {
    const h = estimateHeight(node.data.columns.length);
    g.setNode(node.id, { width: NODE_WIDTH, height: h });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positioned = nodes.map(node => {
    const { x, y } = g.node(node.id);
    const h = estimateHeight(node.data.columns.length);
    return { ...node, position: { x: x - NODE_WIDTH / 2, y: y - h / 2 } };
  });

  return { nodes: positioned, edges };
}
