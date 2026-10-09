import { useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';

type Row = Record<string, unknown>;

interface SheetData {
  name: string;
  rows: Row[];
  columns: string[];
}

interface FileData {
  fileName: string;
  sheets: SheetData[];
}

type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

interface DiffRow {
  status: DiffStatus;
  keyValue: string;
  rowA: Row | null;
  rowB: Row | null;
  changedCols: Set<string>;
}

// ── Parse ──────────────────────────────────────────────────────────
async function parseFile(file: File): Promise<FileData> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sheets: SheetData[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<Row>(ws, { defval: '' });
    if (!rows.length) continue;
    const columns = Object.keys(rows[0]);
    sheets.push({ name, rows, columns });
  }
  return { fileName: file.name, sheets };
}

// ── Diff ───────────────────────────────────────────────────────────
function diffSheets(
  a: SheetData,
  b: SheetData,
  keyCol: string
): DiffRow[] {
  const allCols = [...new Set([...a.columns, ...b.columns])];

  if (keyCol === '__index__') {
    // Index-based match
    const len = Math.max(a.rows.length, b.rows.length);
    const result: DiffRow[] = [];
    for (let i = 0; i < len; i++) {
      const ra = a.rows[i] ?? null;
      const rb = b.rows[i] ?? null;
      if (!ra) {
        result.push({ status: 'added', keyValue: String(i + 1), rowA: null, rowB: rb, changedCols: new Set(allCols) });
      } else if (!rb) {
        result.push({ status: 'removed', keyValue: String(i + 1), rowA: ra, rowB: null, changedCols: new Set(allCols) });
      } else {
        const changed = new Set(allCols.filter(c => String(ra[c] ?? '') !== String(rb[c] ?? '')));
        result.push({ status: changed.size > 0 ? 'modified' : 'unchanged', keyValue: String(i + 1), rowA: ra, rowB: rb, changedCols: changed });
      }
    }
    return result;
  }

  // Key-based match
  const mapA = new Map(a.rows.map(r => [String(r[keyCol] ?? ''), r]));
  const mapB = new Map(b.rows.map(r => [String(r[keyCol] ?? ''), r]));
  const allKeys = [...new Set([...mapA.keys(), ...mapB.keys()])];

  return allKeys.map(key => {
    const ra = mapA.get(key) ?? null;
    const rb = mapB.get(key) ?? null;
    if (!ra) return { status: 'added' as DiffStatus, keyValue: key, rowA: null, rowB: rb, changedCols: new Set(allCols) };
    if (!rb) return { status: 'removed' as DiffStatus, keyValue: key, rowA: ra, rowB: null, changedCols: new Set(allCols) };
    const changed = new Set(allCols.filter(c => String(ra[c] ?? '') !== String(rb[c] ?? '')));
    return { status: changed.size > 0 ? 'modified' as DiffStatus : 'unchanged' as DiffStatus, keyValue: key, rowA: ra, rowB: rb, changedCols: changed };
  });
}

// ── Component ──────────────────────────────────────────────────────
const STATUS_COLOR: Record<DiffStatus, string> = {
  added:     'rgba(63,185,80,0.12)',
  removed:   'rgba(248,81,73,0.12)',
  modified:  'rgba(255,166,87,0.1)',
  unchanged: 'transparent',
};
const STATUS_BORDER: Record<DiffStatus, string> = {
  added:     '#3fb950',
  removed:   '#f85149',
  modified:  '#ffa657',
  unchanged: 'transparent',
};
const STATUS_LABEL: Record<DiffStatus, string> = {
  added: '+', removed: '−', modified: '~', unchanged: ' ',
};

export default function ExcelDiff() {
  const [fileA, setFileA] = useState<FileData | null>(null);
  const [fileB, setFileB] = useState<FileData | null>(null);
  const [sheetA, setSheetA] = useState(0);
  const [sheetB, setSheetB] = useState(0);
  const [keyCol, setKeyCol] = useState('__index__');
  const [filter, setFilter] = useState<DiffStatus | 'all'>('all');
  const [loading, setLoading] = useState(false);

  const loadFile = useCallback(async (side: 'A' | 'B', file: File) => {
    setLoading(true);
    try {
      const data = await parseFile(file);
      if (side === 'A') { setFileA(data); setSheetA(0); }
      else              { setFileB(data); setSheetB(0); }
    } finally { setLoading(false); }
  }, []);

  const sheetDataA = fileA?.sheets[sheetA] ?? null;
  const sheetDataB = fileB?.sheets[sheetB] ?? null;

  const allColumns = useMemo(() => {
    const a = sheetDataA?.columns ?? [];
    const b = sheetDataB?.columns ?? [];
    return [...new Set([...a, ...b])];
  }, [sheetDataA, sheetDataB]);

  const diffRows = useMemo(() => {
    if (!sheetDataA || !sheetDataB) return [];
    return diffSheets(sheetDataA, sheetDataB, keyCol);
  }, [sheetDataA, sheetDataB, keyCol]);

  const stats = useMemo(() => ({
    added:     diffRows.filter(r => r.status === 'added').length,
    removed:   diffRows.filter(r => r.status === 'removed').length,
    modified:  diffRows.filter(r => r.status === 'modified').length,
    unchanged: diffRows.filter(r => r.status === 'unchanged').length,
  }), [diffRows]);

  const visibleRows = useMemo(() =>
    filter === 'all' ? diffRows : diffRows.filter(r => r.status === filter),
    [diffRows, filter]
  );

  return (
    <div className="excel-diff-root">
      {/* ── File pickers ── */}
      <div className="excel-diff-pickers">
        <FilePicker
          side="A"
          file={fileA}
          sheetIdx={sheetA}
          onFile={f => loadFile('A', f)}
          onSheet={setSheetA}
        />
        <div className="excel-diff-vs">VS</div>
        <FilePicker
          side="B"
          file={fileB}
          sheetIdx={sheetB}
          onFile={f => loadFile('B', f)}
          onSheet={setSheetB}
        />
      </div>

      {/* ── Options bar ── */}
      {sheetDataA && sheetDataB && (
        <div className="excel-diff-options">
          <label className="diff-option-label">
            Match rows by:
            <select
              className="diff-select"
              value={keyCol}
              onChange={e => setKeyCol(e.target.value)}
            >
              <option value="__index__">Row index</option>
              {allColumns.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <div className="diff-stats">
            {(['added','removed','modified','unchanged'] as DiffStatus[]).map(s => (
              <button
                key={s}
                className={`diff-stat-btn ${filter === s ? 'active' : ''}`}
                data-status={s}
                onClick={() => setFilter(f => f === s ? 'all' : s)}
              >
                <span className="diff-stat-icon">{STATUS_LABEL[s]}</span>
                {stats[s]} {s}
              </button>
            ))}
            <button
              className={`diff-stat-btn ${filter === 'all' ? 'active' : ''}`}
              onClick={() => setFilter('all')}
            >
              all {diffRows.length}
            </button>
          </div>
        </div>
      )}

      {/* ── Diff table ── */}
      {loading && <div className="empty-state"><p>Parsing…</p></div>}

      {!loading && !sheetDataA && !sheetDataB && (
        <div className="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ width: 48, height: 48, opacity: 0.3 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z"/>
          </svg>
          <p>Load two Excel / CSV files to compare them</p>
        </div>
      )}

      {!loading && sheetDataA && sheetDataB && (
        <div className="excel-diff-table-wrap">
          <table className="excel-diff-table">
            <thead>
              <tr>
                <th className="col-status" />
                <th className="col-key">#</th>
                {allColumns.map(c => (
                  <th key={c} className="col-data">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, i) => {
                if (row.status === 'unchanged') {
                  return (
                    <tr key={i} style={{ background: STATUS_COLOR.unchanged }}>
                      <td className="col-status"><span className="status-badge unchanged"> </span></td>
                      <td className="col-key">{row.keyValue}</td>
                      {allColumns.map(c => (
                        <td key={c} className="col-data">{String(row.rowA?.[c] ?? '')}</td>
                      ))}
                    </tr>
                  );
                }

                if (row.status === 'added') {
                  return (
                    <tr key={i} style={{ background: STATUS_COLOR.added, borderLeft: `3px solid ${STATUS_BORDER.added}` }}>
                      <td className="col-status"><span className="status-badge added">+</span></td>
                      <td className="col-key">{row.keyValue}</td>
                      {allColumns.map(c => (
                        <td key={c} className="col-data added-cell">{String(row.rowB?.[c] ?? '')}</td>
                      ))}
                    </tr>
                  );
                }

                if (row.status === 'removed') {
                  return (
                    <tr key={i} style={{ background: STATUS_COLOR.removed, borderLeft: `3px solid ${STATUS_BORDER.removed}` }}>
                      <td className="col-status"><span className="status-badge removed">−</span></td>
                      <td className="col-key">{row.keyValue}</td>
                      {allColumns.map(c => (
                        <td key={c} className="col-data removed-cell">{String(row.rowA?.[c] ?? '')}</td>
                      ))}
                    </tr>
                  );
                }

                // modified — show A and B rows stacked
                return [
                  <tr key={`${i}-a`} style={{ background: STATUS_COLOR.removed, borderLeft: `3px solid ${STATUS_BORDER.removed}` }}>
                    <td className="col-status" rowSpan={2}><span className="status-badge modified">~</span></td>
                    <td className="col-key modified-key">{row.keyValue} <span style={{ fontSize: 9, color: '#8b949e' }}>A</span></td>
                    {allColumns.map(c => (
                      <td key={c} className={`col-data ${row.changedCols.has(c) ? 'removed-cell' : ''}`}>
                        {String(row.rowA?.[c] ?? '')}
                      </td>
                    ))}
                  </tr>,
                  <tr key={`${i}-b`} style={{ background: STATUS_COLOR.added, borderLeft: `3px solid ${STATUS_BORDER.added}` }}>
                    <td className="col-key modified-key">{row.keyValue} <span style={{ fontSize: 9, color: '#8b949e' }}>B</span></td>
                    {allColumns.map(c => (
                      <td key={c} className={`col-data ${row.changedCols.has(c) ? 'added-cell' : ''}`}>
                        {String(row.rowB?.[c] ?? '')}
                      </td>
                    ))}
                  </tr>,
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── File picker sub-component ──────────────────────────────────────
function FilePicker({
  side, file, sheetIdx, onFile, onSheet,
}: {
  side: 'A' | 'B';
  file: FileData | null;
  sheetIdx: number;
  onFile: (f: File) => void;
  onSheet: (i: number) => void;
}) {
  const color = side === 'A' ? '#58a6ff' : '#3fb950';
  return (
    <div className="excel-picker">
      <div className="excel-picker-header">
        <span className="compare-side-label" style={{ background: `${color}22`, color }}>{side}</span>
        <span className="excel-picker-name">{file?.fileName ?? 'No file loaded'}</span>
        <label className="toolbar-btn" style={{ marginLeft: 'auto', fontSize: 11, padding: '3px 10px' }}>
          {file ? 'Change' : 'Load file'}
          <input type="file" accept=".xlsx,.xls,.csv,.ods" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        </label>
      </div>
      {file && file.sheets.length > 1 && (
        <div className="excel-picker-sheets">
          {file.sheets.map((s, i) => (
            <button
              key={i}
              className={`sheet-tab ${sheetIdx === i ? 'active' : ''}`}
              onClick={() => onSheet(i)}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      {file && (
        <div className="excel-picker-meta">
          {file.sheets[sheetIdx]?.rows.length.toLocaleString()} rows ·{' '}
          {file.sheets[sheetIdx]?.columns.length} columns
        </div>
      )}
    </div>
  );
}
