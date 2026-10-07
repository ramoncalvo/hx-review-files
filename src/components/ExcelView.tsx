import { useState, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import TableNode from './TableNode';
import {
  parseExcelFile,
  detectRelations,
  buildExcelGraph,
  type ParsedTable,
  type Relation,
  type TableData,
} from '../utils/excelToGraph';

const nodeTypes = { tableNode: TableNode };

// ── JSON tree comparison ─────────────────────────────────────────
interface MatchResult {
  score: number; // 0-100
  matched: { tableNode: string; jsonKey: string }[];
  missing: string[];   // tables not found in JSON
  extra: string[];     // JSON keys not matching any table
  relationsCovered: number;
  relationsTotal: number;
}

function extractJsonKeys(obj: unknown, depth = 0): string[] {
  if (depth > 5 || obj === null || typeof obj !== 'object') return [];
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    keys.push(k.toLowerCase());
    if (typeof v === 'object' && v !== null) {
      keys.push(...extractJsonKeys(v, depth + 1));
    }
  }
  return keys;
}

function compareJsonToTables(
  jsonText: string,
  tables: ParsedTable[],
  relations: Relation[]
): MatchResult | null {
  if (!jsonText.trim()) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(jsonText); } catch { return null; }

  const jsonKeys = new Set(extractJsonKeys(parsed));
  const tableNames = tables.map(t => t.tableName.toLowerCase());

  const matched: MatchResult['matched'] = [];
  const missing: string[] = [];

  for (const table of tables) {
    const tLow = table.tableName.toLowerCase();
    // direct match or plural/singular
    const hit =
      jsonKeys.has(tLow) ||
      jsonKeys.has(tLow + 's') ||
      jsonKeys.has(tLow.replace(/s$/, '')) ||
      table.columns.some(c => jsonKeys.has(c.name.toLowerCase()));

    if (hit) {
      const key = [...jsonKeys].find(k =>
        k === tLow || k === tLow + 's' || k === tLow.replace(/s$/, '') ||
        table.columns.some(c => c.name.toLowerCase() === k)
      ) ?? tLow;
      matched.push({ tableNode: table.tableName, jsonKey: key });
    } else {
      missing.push(table.tableName);
    }
  }

  const matchedJsonKeys = new Set(matched.map(m => m.jsonKey));
  const extra = [...jsonKeys].filter(k =>
    !tableNames.some(t => t === k || t + 's' === k || t === k + 's') &&
    !matchedJsonKeys.has(k)
  ).slice(0, 10);

  // check how many relations are represented in JSON
  let relationsCovered = 0;
  for (const rel of relations) {
    if (
      (jsonKeys.has(rel.fromTable.toLowerCase()) || jsonKeys.has(rel.fromTable.toLowerCase() + 's')) &&
      (jsonKeys.has(rel.toTable.toLowerCase())   || jsonKeys.has(rel.toTable.toLowerCase() + 's'))
    ) {
      relationsCovered++;
    }
  }

  const score = tables.length === 0 ? 0 : Math.round(
    (matched.length / tables.length) * 70 +
    (relations.length === 0 ? 30 : (relationsCovered / relations.length) * 30)
  );

  return {
    score,
    matched,
    missing,
    extra,
    relationsCovered,
    relationsTotal: relations.length,
  };
}

// ── Component ────────────────────────────────────────────────────
interface Props {
  jsonText: string; // from Viewer tab for comparison
}

export default function ExcelView({ jsonText }: Props) {
  const [tables, setTables]       = useState<ParsedTable[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [graph, setGraph]         = useState<{ nodes: Node<TableData>[]; edges: Edge[] } | null>(null);
  const [loading, setLoading]     = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [exporting, setExporting] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    try {
      const all: ParsedTable[] = [];
      for (const file of Array.from(files)) {
        const parsed = await parseExcelFile(file);
        all.push(...parsed);
      }
      const rels = detectRelations(all);
      const g = buildExcelGraph(all, rels);
      setTables(all);
      setRelations(rels);
      setGraph(g);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handleExport = useCallback(async () => {
    const el = canvasRef.current?.querySelector('.react-flow__renderer') as HTMLElement | null;
    if (!el) return;
    setExporting(true);
    try {
      const url = await toPng(el, { backgroundColor: '#0d1117', pixelRatio: 2 });
      const a = document.createElement('a');
      a.href = url;
      a.download = `db-schema-${Date.now()}.png`;
      a.click();
    } finally {
      setExporting(false);
    }
  }, []);

  const compareResult = showCompare ? compareJsonToTables(jsonText, tables, relations) : null;

  return (
    <div className="excel-root">
      {/* ── Toolbar ── */}
      <div className="excel-toolbar">
        <label className="toolbar-btn">
          <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 14, height: 14 }}>
            <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z"/>
          </svg>
          Load Excel / CSV
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv,.ods"
            style={{ display: 'none' }}
            onChange={e => handleFiles(e.target.files)}
          />
        </label>

        {graph && (
          <>
            <span className="toolbar-sep" />
            <button className="toolbar-btn primary" onClick={handleExport} disabled={exporting}>
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 14, height: 14 }}>
                <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z"/>
                <path d="M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.97a.749.749 0 1 1 1.06 1.061l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.061l1.97 1.97Z"/>
              </svg>
              Export PNG
            </button>

            <button
              className={`toolbar-btn ${showCompare ? 'active-compare' : ''}`}
              onClick={() => setShowCompare(v => !v)}
            >
              <svg viewBox="0 0 16 16" fill="currentColor" style={{ width: 14, height: 14 }}>
                <path d="M8.75 1.75a.75.75 0 0 0-1.5 0V5H4.5a.75.75 0 0 0 0 1.5h2.75v2.75a.75.75 0 0 0 1.5 0V6.5h2.75a.75.75 0 0 0 0-1.5H8.75ZM1.5 11.25a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 0 1.5H2.25a.75.75 0 0 1-.75-.75Z"/>
              </svg>
              Compare with JSON
            </button>

            <span className="toolbar-info">
              {tables.length} tables · {relations.length} relations
            </span>
          </>
        )}
      </div>

      {/* ── Body ── */}
      <div className="excel-body">
        {/* Canvas */}
        <div
          className="canvas-area"
          ref={canvasRef}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
        >
          {loading && (
            <div className="empty-state">
              <p>Parsing files…</p>
            </div>
          )}

          {!loading && !graph && (
            <div className="excel-drop-zone">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ width: 52, height: 52, opacity: 0.3 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75.125V7.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V18.375m-3.75.125h3.75M6 7.875V18.375m0 0h1.5c.621 0 1.125-.504 1.125-1.125V6.75c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v10.5c0 .621-.504 1.125-1.125 1.125H9m-3 0h3m3 0h1.5c.621 0 1.125-.504 1.125-1.125V9c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v9.375c0 .621-.504 1.125-1.125 1.125H15"/>
              </svg>
              <p>Drop Excel / CSV files here</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>or use "Load Excel / CSV" above · supports .xlsx .xls .csv .ods · multiple files</p>
            </div>
          )}

          {!loading && graph && (
            <ReactFlowProvider>
              <ReactFlow
                nodes={graph.nodes}
                edges={graph.edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.1 }}
                onNodesChange={() => {}}
                onEdgesChange={() => {}}
                minZoom={0.05}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
              >
                <Background variant={BackgroundVariant.Dots} color="#21262d" gap={20} size={1} />
                <Controls />
                <MiniMap nodeColor="#21262d" maskColor="rgba(13,17,23,0.8)" style={{ bottom: 16, right: 16 }} />
              </ReactFlow>
            </ReactFlowProvider>
          )}
        </div>

        {/* Compare panel */}
        {showCompare && graph && (
          <div className="compare-panel">
            <div className="compare-panel-title">
              JSON ↔ Schema Match
              <button className="compare-panel-close" onClick={() => setShowCompare(false)}>✕</button>
            </div>

            {!jsonText.trim() ? (
              <div className="compare-panel-empty">No JSON in Viewer tab yet</div>
            ) : compareResult ? (
              <>
                {/* Score */}
                <div className="match-score-wrap">
                  <div
                    className="match-score-ring"
                    style={{ '--score': compareResult.score } as React.CSSProperties}
                  >
                    <span className="match-score-num">{compareResult.score}%</span>
                  </div>
                  <div className="match-score-label">
                    {compareResult.score >= 80 ? 'Strong match' :
                     compareResult.score >= 50 ? 'Partial match' : 'Low match'}
                  </div>
                </div>

                {/* Stats */}
                <div className="match-stats">
                  <div className="match-stat green">
                    <strong>{compareResult.matched.length}</strong>
                    <span>tables found in JSON</span>
                  </div>
                  <div className="match-stat red">
                    <strong>{compareResult.missing.length}</strong>
                    <span>tables missing</span>
                  </div>
                  <div className="match-stat blue">
                    <strong>{compareResult.relationsCovered}/{compareResult.relationsTotal}</strong>
                    <span>relations covered</span>
                  </div>
                </div>

                {/* Matched */}
                {compareResult.matched.length > 0 && (
                  <div className="match-section">
                    <div className="match-section-title green">✓ Matched</div>
                    {compareResult.matched.map((m, i) => (
                      <div key={i} className="match-row">
                        <span className="match-table">{m.tableNode}</span>
                        <span className="match-arrow">→</span>
                        <span className="match-json-key">{m.jsonKey}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Missing */}
                {compareResult.missing.length > 0 && (
                  <div className="match-section">
                    <div className="match-section-title red">✗ Not found in JSON</div>
                    {compareResult.missing.map((t, i) => (
                      <div key={i} className="match-row">
                        <span className="match-table missing">{t}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="compare-panel-empty">Could not parse JSON</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
