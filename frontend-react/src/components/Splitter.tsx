import React, { useState, useCallback, useEffect } from 'react';

interface SplitterProps {
  side: 'left' | 'right';
  onResize: (deltaX: number) => void;
  className?: string;
}

export const Splitter: React.FC<SplitterProps> = ({ side, onResize, className = '' }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    let lastX: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (lastX !== null) {
        const delta = e.clientX - lastX;
        // If it's the right sidebar, moving left increases width (negative delta -> positive width change)
        const adjustedDelta = side === 'left' ? delta : -delta;
        onResize(adjustedDelta);
      }
      lastX = e.clientX;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, onResize, side]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className={`relative z-50 flex items-center justify-center cursor-col-resize group select-none ${
        side === 'left' ? '-mr-1.5' : '-ml-1.5'
      } w-3 flex-shrink-0 ${className}`}
      title="Drag to resize panel"
    >
      {/* 1px visual border line */}
      <div
        className={`w-[1px] h-full transition-colors duration-150 ${
          isDragging
            ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'
            : 'bg-zinc-800/80 group-hover:bg-zinc-600'
        }`}
      />
      {/* Subtle grip handle pill on hover */}
      <div
        className={`absolute w-1 h-8 rounded-full transition-all duration-150 ${
          isDragging
            ? 'bg-blue-500 scale-110'
            : 'bg-transparent group-hover:bg-zinc-500/50'
        }`}
      />
    </div>
  );
};
