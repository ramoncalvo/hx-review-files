import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { TableData, ColInfo } from '../utils/excelToGraph';

const TYPE_COLORS: Record<ColInfo['type'], string> = {
  id:      '#ffa657',
  fk:      '#d2a8ff',
  string:  '#79c0ff',
  number:  '#7ee787',
  date:    '#f78166',
  boolean: '#ff7b72',
};

const TYPE_LABELS: Record<ColInfo['type'], string> = {
  id:      'PK',
  fk:      'FK',
  string:  'str',
  number:  'num',
  date:    'date',
  boolean: 'bool',
};

interface Props { data: TableData }

function TableNode({ data }: Props) {
  const { tableName, fileName, columns, rowCount } = data;

  return (
    <div className="table-node">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />

      <div className="table-node-header">
        <span className="table-icon">⊞</span>
        <span className="table-name">{tableName}</span>
        <span className="table-file">{fileName}</span>
      </div>

      <div className="table-node-body">
        {columns.map((col, i) => (
          <div key={i} className={`table-col-row ${col.isKey ? 'is-key' : ''}`}>
            <span
              className="col-type-badge"
              style={{ color: TYPE_COLORS[col.type], borderColor: TYPE_COLORS[col.type] + '40' }}
            >
              {TYPE_LABELS[col.type]}
            </span>
            <span className="col-name">{col.name}</span>
            {col.sample && <span className="col-sample">{col.sample}</span>}
          </div>
        ))}
      </div>

      <div className="table-node-footer">
        {rowCount.toLocaleString()} rows · {columns.length} cols
      </div>

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

export default memo(TableNode);
