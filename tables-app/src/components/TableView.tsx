import type { Entity, EntityConfig } from '../types';

interface TableViewProps {
  config: EntityConfig;
  data: Entity[];
  onRowClick: (id: string) => void;
}

export default function TableView({ config, data, onRowClick }: TableViewProps) {
  const formatValue = (value: any, type: string) => {
    if (value === null || value === undefined) return '-';

    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value);
      case 'percent':
        return `${Math.round(value * 100)}%`;
      case 'date':
        return new Date(value).toLocaleDateString();
      case 'number':
        return value.toString();
      default:
        return value.toString();
    }
  };

  return (
    <div className="table-view">
      <div className="table-header">
        <h2>{config.labelPlural}</h2>
        <div className="record-count">{data.length} records</div>
      </div>

      {data.length === 0 ? (
        <div className="empty-state">
          No {config.labelPlural.toLowerCase()} found
        </div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              {config.fields.map((field) => (
                <th key={field.key}>{field.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((record: any) => (
              <tr key={record.id} onClick={() => onRowClick(record.id)}>
                {config.fields.map((field) => (
                  <td key={field.key}>
                    {formatValue(record[field.key], field.type)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
