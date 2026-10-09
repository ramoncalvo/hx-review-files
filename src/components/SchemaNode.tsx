import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { SchemaNodeData } from '../utils/jsonToSchema';

const TYPE_COLOR: Record<string, string> = {
  string:  '#79c0ff',
  number:  '#ffa657',
  boolean: '#ff7b72',
  null:    '#8b949e',
  object:  '#d2a8ff',
  array:   '#f78166',
};

function typeColor(t: string): string {
  for (const [k, v] of Object.entries(TYPE_COLOR)) {
    if (t.startsWith(k)) return v;
  }
  return '#8b949e';
}

interface Props { data: SchemaNodeData }

function SchemaNode({ data }: Props) {
  const { label, nodeKind, rows } = data;

  const badgeClass =
    nodeKind === 'root'  ? 'badge-root' :
    nodeKind === 'array' ? 'badge-array' : 'badge-object';

  const badgeLabel =
    nodeKind === 'root'  ? 'root' :
    nodeKind === 'array' ? 'array' : 'object';

  return (
    <div className="json-node schema-node">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      <div className="json-node-header">
        <span>{label}</span>
        <span className={`node-type-badge ${badgeClass}`}>{badgeLabel}</span>
      </div>

      <div className="json-node-body">
        {rows.map((row, i) => {
          // Array header row
          if (row.key.startsWith('Array[') && row.typeLabel === '') {
            return (
              <div key={i} className="json-row schema-array-header">
                <span style={{ color: '#f78166', fontWeight: 700 }}>{row.key}</span>
                <span style={{ color: '#484f58', fontSize: 10, marginLeft: 6 }}>items schema ↓</span>
              </div>
            );
          }

          const color = typeColor(row.typeLabel);
          return (
            <div key={i} className={`json-row ${row.isRef ? 'schema-ref-row' : ''}`}>
              {row.key && (
                <>
                  <span className="json-key">
                    {row.key}
                    {row.optional && <span style={{ color: '#484f58' }}>?</span>}
                  </span>
                  <span className="json-colon">:</span>
                </>
              )}
              <span
                className="json-val"
                style={{ color, fontStyle: row.isRef ? 'italic' : 'normal', opacity: row.isRef ? 0.8 : 1 }}
              >
                {row.typeLabel || '…'}
              </span>
            </div>
          );
        })}
      </div>

      <div className="json-node-footer schema-footer">
        {rows.filter(r => !r.key.startsWith('Array[')).length} properties
      </div>

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

export default memo(SchemaNode);
