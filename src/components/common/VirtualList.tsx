import React, { useRef, useState, useEffect, useCallback } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight?: number | string;
  overscan?: number;
  className?: string;
  style?: React.CSSProperties;
  renderItem: (item: T, index: number) => React.ReactNode;
}

export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight = 400,
  overscan = 5,
  className = '',
  style = {},
  renderItem
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [clientH, setClientH] = useState(
    typeof containerHeight === 'number' ? containerHeight : 400
  );

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateHeight = () => {
      setClientH(el.clientHeight || (typeof containerHeight === 'number' ? containerHeight : 400));
    };

    updateHeight();

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [containerHeight]);

  const totalCount = items.length;
  const totalHeight = totalCount * itemHeight;

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    totalCount,
    Math.ceil((scrollTop + clientH) / itemHeight) + overscan
  );

  const visibleItems = items.slice(startIndex, endIndex);
  const paddingTop = startIndex * itemHeight;
  const paddingBottom = Math.max(0, totalHeight - endIndex * itemHeight);

  return (
    <div
      ref={containerRef}
      onScroll={onScroll}
      className={className}
      style={{
        height: containerHeight,
        overflowY: 'auto',
        overflowX: 'hidden',
        position: 'relative',
        ...style
      }}
    >
      <div style={{ paddingTop, paddingBottom, boxSizing: 'border-box' }}>
        {visibleItems.map((item, index) => {
          const actualIndex = startIndex + index;
          return (
            <div key={actualIndex} style={{ height: itemHeight, boxSizing: 'border-box' }}>
              {renderItem(item, actualIndex)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualList;
