import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeData, JsonValue } from '../utils/jsonToGraph';

function formatValue(v: JsonValue): { text: string; cls: string } {
  if (v === null) return { text: 'null', cls: 'val-null' };
  if (typeof v === 'boolean') return { text: String(v), cls: 'val-boolean' };
  if (typeof v === 'number') return { text: String(v), cls: 'val-number' };
  if (typeof v === 'string') return { text: `"${v}"`, cls: 'val-string' };
  if (Array.isArray(v)) return { text: `[…] ${(v as unknown[]).length}`, cls: 'val-ref' };
  return { text: '{…}', cls: 'val-ref' };
}

interface Props {
  data: NodeData;
}

function JsonNode({ data }: Props) {
  const { label, entries, nodeType, size } = data;

  const badgeClass =
    nodeType === 'root' ? 'badge-root' :
    nodeType === 'array' ? 'badge-array' : 'badge-object';

  const badgeLabel =
    nodeType === 'root' ? 'root' :
    nodeType === 'array' ? 'array' : 'object';

  return (
    <div className="json-node">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      <div className="json-node-header">
        <span>{label}</span>
        <span className={`node-type-badge ${badgeClass}`}>{badgeLabel}</span>
      </div>

      <div className="json-node-body">
        {entries.map((entry, i) => {
          if (entry.isRef) {
            return (
              <div className="json-row" key={i}>
                <span className="json-key">{entry.key}</span>
                <span className="json-colon">:</span>
                <span className="json-val val-ref">
                  {Array.isArray(entry.value)
                    ? `[…] ${(entry.value as unknown[]).length}`
                    : '{…}'}
                </span>
              </div>
            );
          }
          const { text, cls } = formatValue(entry.value);
          return (
            <div className="json-row" key={i}>
              {entry.key !== '' && (
                <>
                  <span className="json-key">{entry.key}</span>
                  <span className="json-colon">:</span>
                </>
              )}
              <span className={`json-val ${cls}`}>{text}</span>
            </div>
          );
        })}
      </div>

      {size > 0 && (
        <div className="json-node-footer">
          {size} {size === 1 ? 'entry' : 'entries'}
        </div>
      )}

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

export default memo(JsonNode);
