import React from 'react';

export interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
  isMono?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No records in store.',
  onRowClick,
}: DataTableProps<T>) {
  return (
    <div className="w-full border border-muted-border bg-surface rounded-xs overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs font-sans">
        <thead>
          <tr className="border-b border-muted-border bg-subtle text-ink-secondary">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={`py-2 px-3 font-semibold text-[11px] tracking-wider uppercase ${col.className || ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-muted-border text-ink">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-6 text-center text-ink-tertiary italic"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick && onRowClick(row)}
                className={`hover:bg-subtle transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((col, idx) => {
                  const content =
                    typeof col.accessor === 'function'
                      ? col.accessor(row)
                      : (row[col.accessor] as unknown as React.ReactNode);

                  return (
                    <td
                      key={idx}
                      className={`py-2 px-3 align-top ${
                        col.isMono ? 'font-mono text-[11px]' : ''
                      } ${col.className || ''}`}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
