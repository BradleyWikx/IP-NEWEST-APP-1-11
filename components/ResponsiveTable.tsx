
import React from 'react';
import { Card } from './UI';

interface Column<T> {
  header: string;
  accessor: (item: T) => React.ReactNode;
  className?: string; // For hiding on mobile e.g., "hidden md:table-cell"
}

interface ResponsiveTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  // Optional: Custom mobile renderer if the auto-card isn't enough
  renderMobileItem?: (item: T) => React.ReactNode;
}

export const ResponsiveTable = <T extends any>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = "Geen data gevonden.",
  isLoading = false,
  renderMobileItem
}: ResponsiveTableProps<T>) => {

  if (isLoading) {
    return <div className="p-12 text-center text-slate-500">Laden...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-xl bg-slate-900/50 text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase tracking-widest font-bold">
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx} className={`p-4 border-b border-slate-800 ${col.className || ''}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {data.map((item) => (
                <tr 
                  key={keyExtractor(item)} 
                  onClick={() => onRowClick && onRowClick(item)}
                  className={`group transition-colors ${onRowClick ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}
                >
                  {columns.map((col, idx) => (
                    <td key={idx} className={`p-4 ${col.className || ''}`}>
                      {col.accessor(item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {data.map((item) => (
          <Card 
            key={keyExtractor(item)} 
            onClick={() => onRowClick && onRowClick(item)}
            className="p-4 active:scale-[0.98] transition-transform"
          >
            {renderMobileItem ? (
              renderMobileItem(item)
            ) : (
              // Default Card Renderer: Stack headers and values
              <div className="space-y-3">
                {columns.map((col, idx) => (
                  <div key={idx} className="flex justify-between items-start border-b border-slate-800/50 last:border-0 pb-2 last:pb-0">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">{col.header}</span>
                    <div className="text-right text-sm text-slate-200 pl-4">
                      {col.accessor(item)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </>
  );
};
