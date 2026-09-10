import type { ReactNode } from "react";
import EmptyState from "../EmptyState";

export interface ResourceColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface ResourceTableProps<T> {
  data: T[];
  columns: ResourceColumn<T>[];
  emptyTitle: string;
  emptyDescription?: string;
}

export default function ResourceTable<T>({
  data,
  columns,
  emptyTitle,
  emptyDescription,
}: ResourceTableProps<T>) {
  if (data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="admin-table-wrapper">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={col.className}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col.key} className={col.className}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
