import { useState } from 'react';

interface Tab {
  id: string;
  icon: string;
  label: string;
  color: string;
  headline: string;
  sections: { title: string; items: string[] }[];
}

const TABS: Tab[] = [
  {
    id: 'viewer',
    icon: '⬡',
    label: 'Viewer',
    color: '#58a6ff',
    headline: 'Visualize any JSON as an interactive node graph.',
    sections: [
      {
        title: 'Input',
        items: [
          'Paste JSON directly into the left panel or click Load file to open a .json file.',
          'Click Format to auto-indent your JSON before rendering.',
          'Click Paste to pull text straight from your clipboard.',
        ],
      },
      {
        title: 'Graph',
        items: [
          'Each object / array becomes a node. Nested children become linked child nodes.',
          'Primitive values (strings, numbers, booleans, null) are shown inline inside their parent node.',
          'Drag to pan · scroll to zoom · use the minimap (bottom-right) for a bird\'s-eye view.',
        ],
      },
      {
        title: 'Export',
        items: [
          'Click Export → PNG for a high-resolution (2×) raster image — great for slides and review.',
          'Click Export → SVG for a scalable vector file — perfect for documentation.',
          'Filename includes a timestamp so exports never overwrite each other.',
        ],
      },
    ],
  },
  {
    id: 'compare',
    icon: '⇄',
    label: 'Compare',
    color: '#3fb950',
    headline: 'Diff any two text files side by side in real time.',
    sections: [
      {
        title: 'Editors',
        items: [
          'Paste or type into the A (left) and B (right) editors.',
          'Click Load file on either side to open a .json, .js, .ts, or any text file.',
          'Click Format on a JSON side to normalize indentation before diffing.',
          'Language is auto-detected (JSON · JS · TS · text) and shown next to the editor label.',
        ],
      },
      {
        title: 'Diff output',
        items: [
          'Lines added in B are highlighted green (+).',
          'Lines removed from A are highlighted red (−).',
          'Unchanged lines are shown in grey.',
          'The header shows total lines added / removed, or "✓ Identical" when both sides match.',
        ],
      },
      {
        title: 'Auto-format toggle',
        items: [
          'Enable "Auto-format JSON before diff" to ignore cosmetic differences like indentation.',
          'Useful when comparing a minified JSON against a pretty-printed one.',
        ],
      },
    ],
  },
  {
    id: 'schema',
    icon: '⊞',
    label: 'Schema',
    color: '#ffa657',
    headline: 'Upload Excel / CSV files and visualize your database schema as a graph.',
    sections: [
      {
        title: 'Loading files',
        items: [
          'Click Load Excel / CSV or drag-and-drop files onto the canvas.',
          'Supports .xlsx · .xls · .csv · .ods — load multiple files at once.',
          'Each sheet in a workbook becomes its own table node.',
        ],
      },
      {
        title: 'Column types',
        items: [
          'PK — column named "id" (primary key, orange).',
          'FK — column ending in "_id" (foreign key, purple).',
          'str / num / date / bool — inferred from cell values.',
          'Columns that participate in a detected relationship are highlighted inside the node.',
        ],
      },
      {
        title: 'Relationship detection',
        items: [
          'Two tables sharing a column with the same name → an edge is drawn between them.',
          'A column named users_id in table B → infers a relation to a table named users.',
          'Edge labels show the linking column name.',
        ],
      },
      {
        title: 'Compare with JSON',
        items: [
          'Click "Compare with JSON" to open the match panel.',
          'The tool checks whether the tables and relations in your Excel are represented in the JSON from the Viewer tab.',
          'A 0–100% score is shown: 70% weighted on table coverage + 30% on relation coverage.',
          'Great for verifying that your API payload / config file mirrors your actual database structure.',
        ],
      },
    ],
  },
];

interface Props {
  onClose: () => void;
}

export default function WelcomeModal({ onClose }: Props) {
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  return (
    <div className="welcome-overlay" onClick={onClose}>
      <div className="welcome-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="welcome-header">
          <div className="welcome-title">
            <span className="welcome-logo">Ramon <span>JSON Viewer</span></span>
            <span className="welcome-subtitle">Quick start guide</span>
          </div>
          <button className="welcome-close" onClick={onClose}>✕</button>
        </div>

        {/* Tab switcher */}
        <div className="welcome-tabs">
          {TABS.map((t, i) => (
            <button
              key={t.id}
              className={`welcome-tab-btn ${active === i ? 'active' : ''}`}
              style={{ '--tab-color': t.color } as React.CSSProperties}
              onClick={() => setActive(i)}
            >
              <span className="wtab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="welcome-content">
          <p className="welcome-headline" style={{ color: tab.color }}>{tab.headline}</p>

          {tab.sections.map((sec, si) => (
            <div key={si} className="welcome-section">
              <div className="welcome-section-title">{sec.title}</div>
              <ul className="welcome-list">
                {sec.items.map((item, ii) => (
                  <li key={ii}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="welcome-footer">
          <div className="welcome-dots">
            {TABS.map((_, i) => (
              <button
                key={i}
                className={`welcome-dot ${active === i ? 'active' : ''}`}
                onClick={() => setActive(i)}
              />
            ))}
          </div>
          <div className="welcome-footer-actions">
            {active < TABS.length - 1 ? (
              <button className="toolbar-btn primary" onClick={() => setActive(a => a + 1)}>
                Next →
              </button>
            ) : (
              <button className="toolbar-btn primary" onClick={onClose}>
                Get started
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
