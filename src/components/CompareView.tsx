import { useState, useMemo, useCallback } from 'react';
import { diffLines, type Change } from 'diff';

type Lang = 'json' | 'js' | 'ts' | 'text';

function detectLang(text: string): Lang {
  const t = text.trim();
  if (!t) return 'text';
  try { JSON.parse(t); return 'json'; } catch { /* not json */ }
  if (/^(import |export |const |let |var |function |class |\/\/)/.test(t)) return 'js';
  if (/(:\s*(string|number|boolean|any|void|unknown)[\s,;|)]|interface\s+\w|type\s+\w+\s*=)/.test(t)) return 'ts';
  return 'text';
}

function formatJson(text: string): string {
  try { return JSON.stringify(JSON.parse(text), null, 2); } catch { return text; }
}

const SAMPLE_LEFT = JSON.stringify({
  name: "api-service",
  version: "1.0.0",
  config: { port: 3000, debug: false, timeout: 30 },
  features: ["auth", "cache", "logging"],
  database: { host: "localhost", port: 5432, name: "mydb" }
}, null, 2);

const SAMPLE_RIGHT = JSON.stringify({
  name: "api-service",
  version: "2.0.0",
  config: { port: 8080, debug: true, timeout: 60, maxRetries: 3 },
  features: ["auth", "cache", "logging", "metrics"],
  database: { host: "db.prod.internal", port: 5432, name: "mydb", ssl: true }
}, null, 2);

export default function CompareView() {
  const [left, setLeft]   = useState(SAMPLE_LEFT);
  const [right, setRight] = useState(SAMPLE_RIGHT);
  const [autoFormat, setAutoFormat] = useState(true);

  const leftLang  = useMemo(() => detectLang(left), [left]);
  const rightLang = useMemo(() => detectLang(right), [right]);

  const effectiveLeft  = useMemo(() => autoFormat && leftLang  === 'json' ? formatJson(left)  : left,  [left,  leftLang,  autoFormat]);
  const effectiveRight = useMemo(() => autoFormat && rightLang === 'json' ? formatJson(right) : right, [right, rightLang, autoFormat]);

  const diff: Change[] = useMemo(
    () => diffLines(effectiveLeft, effectiveRight),
    [effectiveLeft, effectiveRight]
  );

  const stats = useMemo(() => {
    let added = 0, removed = 0;
    for (const c of diff) {
      const lines = (c.value.match(/\n/g) || []).length || 1;
      if (c.added)   added   += lines;
      if (c.removed) removed += lines;
    }
    return { added, removed, same: diff.filter(c => !c.added && !c.removed).length > 0 };
  }, [diff]);

  const handleLoad = useCallback((side: 'left' | 'right', text: string) => {
    if (side === 'left') setLeft(text);
    else setRight(text);
  }, []);

  const identical = stats.added === 0 && stats.removed === 0;

  return (
    <div className="compare-root">
      {/* ── Top bar ── */}
      <div className="compare-topbar">
        <div className="compare-panel-header">
          <span className="compare-side-label left">A</span>
          <span className="lang-badge">{leftLang}</span>
          <label className="compare-load-btn">
            Load file
            <input type="file" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => handleLoad('left', ev.target?.result as string ?? ''); r.readAsText(f); e.target.value = ''; }} />
          </label>
          <button className="compare-load-btn" onClick={() => setLeft(formatJson(left))}>Format</button>
          <button className="compare-load-btn danger" onClick={() => setLeft('')}>Clear</button>
        </div>

        <div className="compare-panel-header">
          <span className="compare-side-label right">B</span>
          <span className="lang-badge">{rightLang}</span>
          <label className="compare-load-btn">
            Load file
            <input type="file" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => handleLoad('right', ev.target?.result as string ?? ''); r.readAsText(f); e.target.value = ''; }} />
          </label>
          <button className="compare-load-btn" onClick={() => setRight(formatJson(right))}>Format</button>
          <button className="compare-load-btn danger" onClick={() => setRight('')}>Clear</button>
        </div>
      </div>

      {/* ── Editors ── */}
      <div className="compare-editors">
        <textarea
          className="compare-textarea"
          value={left}
          onChange={e => setLeft(e.target.value)}
          placeholder="Paste left file here…"
          spellCheck={false}
        />
        <textarea
          className="compare-textarea"
          value={right}
          onChange={e => setRight(e.target.value)}
          placeholder="Paste right file here…"
          spellCheck={false}
        />
      </div>

      {/* ── Diff output ── */}
      <div className="compare-diff-area">
        <div className="compare-diff-header">
          <span>Diff</span>
          {identical ? (
            <span className="diff-stat identical">✓ Identical</span>
          ) : (
            <>
              <span className="diff-stat added">+{stats.added} added</span>
              <span className="diff-stat removed">−{stats.removed} removed</span>
            </>
          )}
          <label className="diff-toggle">
            <input type="checkbox" checked={autoFormat} onChange={e => setAutoFormat(e.target.checked)} />
            Auto-format JSON before diff
          </label>
        </div>

        <div className="diff-output">
          {diff.length === 0 ? (
            <div className="diff-empty">Paste content above to compare</div>
          ) : identical ? (
            <div className="diff-empty identical">Files are identical</div>
          ) : (
            diff.map((chunk, i) => {
              const lines = chunk.value.replace(/\n$/, '').split('\n');
              const cls = chunk.added ? 'diff-added' : chunk.removed ? 'diff-removed' : 'diff-same';
              const prefix = chunk.added ? '+' : chunk.removed ? '−' : ' ';
              return lines.map((line, j) => (
                <div key={`${i}-${j}`} className={`diff-line ${cls}`}>
                  <span className="diff-prefix">{prefix}</span>
                  <span className="diff-content">{line}</span>
                </div>
              ));
            })
          )}
        </div>
      </div>
    </div>
  );
}
