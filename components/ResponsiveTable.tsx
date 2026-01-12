
import React, { useRef, useState, useEffect, useMemo } from 'react';
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
  renderMobileItem?: (item: T) => React.ReactNode;
  isVirtual?: boolean; // NEW: Enable virtualization
  virtualHeight?: string; // Height of the scroll container (default 600px)
}

export const ResponsiveTable = <T extends any>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = "Geen data gevonden.",
  isLoading = false,
  renderMobileItem,
  isVirtual = false,
  virtualHeight = "600px"
}: ResponsiveTableProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // Constants for row heights (Approximations)
  const ROW_HEIGHT_DESKTOP = 60; 
  const ROW_HEIGHT_MOBILE = 180; // Estimate for cards

  useEffect(() => {
    if (containerRef.current) {
      setContainerHeight(containerRef.current.clientHeight);
      
      const handleScroll = (e: Event) => {
        setScrollTop((e.target as HTMLDivElement).scrollTop);
      };
      
      const el = containerRef.current;
      el.addEventListener('scroll', handleScroll);
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [isLoading, isVirtual]);

  // Virtualization Logic
  const { virtualItems, totalHeight, paddingTop, paddingBottom, isDesktop } = useMemo(() => {
    if (!isVirtual || data.length === 0) {
      return { virtualItems: data, totalHeight: 0, paddingTop: 0, paddingBottom: 0, isDesktop: true };
    }

    // Determine simplified breakpoint (In real app, use useMediaQuery hook)
    const isDesk = window.innerWidth >= 768; 
    const itemHeight = isDesk ? ROW_HEIGHT_DESKTOP : ROW_HEIGHT_MOBILE;
    
    const totalH = data.length * itemHeight;
    const startIndex = Math.floor(scrollTop / itemHeight);
    // Buffer: Render 5 extra items above and below
    const effectiveStart = Math.max(0, startIndex - 5);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const effectiveEnd = Math.min(data.length, startIndex + visibleCount + 5);

    const items = data.slice(effectiveStart, effectiveEnd);
    const topPad = effectiveStart * itemHeight;
    const bottomPad = (data.length - effectiveEnd) * itemHeight;

    return { 
      virtualItems: items, 
      totalHeight: totalH, 
      paddingTop: topPad, 
      paddingBottom: bottomPad,
      isDesktop: isDesk
    };
  }, [data, scrollTop, containerHeight, isVirtual]);

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

  const Container = isVirtual ? 'div' : React.Fragment;
  const containerProps = isVirtual ? {
    ref: containerRef,
    className: "overflow-y-auto custom-scrollbar border border-slate-800 rounded-2xl bg-slate-900",
    style: { height: virtualHeight }
  } : {};

  return (
    <Container {...containerProps}>
      {/* Desktop Table View */}
      <div className="hidden md:block bg-slate-900 border-b border-slate-800 rounded-t-2xl overflow-hidden relative">
        <div className={!isVirtual ? "overflow-x-auto rounded-2xl border border-slate-800" : ""}>
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-950 text-slate-500 text-[10px] uppercase tracking-widest font-bold sticky top-0 z-10 shadow-sm">
              <tr>
                {columns.map((col, idx) => (
                  <th key={idx} className={`p-4 border-b border-slate-800 bg-slate-950 ${col.className || ''}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm">
              {isVirtual && paddingTop > 0 && (
                <tr><td colSpan={columns.length} style={{ height: paddingTop }} /></tr>
              )}
              
              {virtualItems.map((item) => (
                <tr 
                  key={keyExtractor(item)} 
                  onClick={() => onRowClick && onRowClick(item)}
                  className={`group transition-colors h-[60px] ${onRowClick ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}
                >
                  {columns.map((col, idx) => (
                    <td key={idx} className={`p-4 ${col.className || ''}`}>
                      {col.accessor(item)}
                    </td>
                  ))}
                </tr>
              ))}

              {isVirtual && paddingBottom > 0 && (
                <tr><td colSpan={columns.length} style={{ height: paddingBottom }} /></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4 p-1">
        {isVirtual && <div style={{ height: paddingTop }} />}
        
        {virtualItems.map((item) => (
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

        {isVirtual && <div style={{ height: paddingBottom }} />}
      </div>
    </Container>
  );
};
