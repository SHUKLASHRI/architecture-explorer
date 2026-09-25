import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useExplorer } from '../context/ExplorerContext';
import { Search, X, ArrowRight } from 'lucide-react';
import type { GraphNode } from '../types';

export const CommandPaletteModal: React.FC = () => {
  const { isSpotlightOpen, closeSpotlight, nodes, selectNode } = useExplorer();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSpotlightOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isSpotlightOpen]);

  const filteredNodes = useMemo(() => {
    if (!query.trim()) return nodes.slice(0, 15);
    const q = query.toLowerCase();
    return nodes
      .filter((n) => n.name.toLowerCase().includes(q) || n.filename.toLowerCase().includes(q))
      .slice(0, 15);
  }, [nodes, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredNodes]);

  const handleSelect = (node: GraphNode) => {
    selectNode(node);
    closeSpotlight();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredNodes.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredNodes.length) % Math.max(1, filteredNodes.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredNodes[selectedIndex]) {
        handleSelect(filteredNodes[selectedIndex]);
      }
    }
  };

  if (!isSpotlightOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-start justify-center pt-[15vh]"
      onClick={closeSpotlight}
    >
      <div
        className="w-[560px] max-w-[92vw] bg-[#121216] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col font-sans select-none"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-3.5 py-3 border-b border-zinc-800 gap-2.5">
          <Search size={16} className="text-zinc-500" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Python AST symbols, classes, functions..."
            className="flex-1 bg-transparent border-none text-zinc-100 placeholder-zinc-500 text-xs focus:outline-none font-mono"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-zinc-500 hover:text-zinc-300 p-0.5 rounded"
            >
              <X size={14} />
            </button>
          )}
          <kbd className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700/60">
            esc
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[340px] overflow-y-auto p-1.5 space-y-0.5 code-scroll">
          {filteredNodes.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 font-mono text-xs">
              No matching AST symbols found for "{query}"
            </div>
          ) : (
            filteredNodes.map((node, index) => {
              const isSelected = index === selectedIndex;
              const isClass = node.kind === 'class';

              return (
                <div
                  key={node.id}
                  onClick={() => handleSelect(node)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-600/20 text-blue-200 border border-blue-500/40'
                      : 'text-zinc-300 hover:bg-zinc-800/50'
                  }`}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                        isClass
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {isClass ? 'cls' : 'fn'}
                    </span>
                    <span className="font-mono text-xs font-medium text-zinc-100 truncate">
                      {node.name}
                    </span>
                    <span className="text-[11px] font-mono text-zinc-500 truncate">
                      {node.filename}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] font-mono text-zinc-500">
                    <span>L{node.line}</span>
                    {isSelected && <ArrowRight size={12} className="text-blue-400" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer Keybinds */}
        <div className="px-3.5 py-2 border-t border-zinc-800 bg-[#0e0e11] flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <div className="flex items-center space-x-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>esc Dismiss</span>
          </div>
          <span>{filteredNodes.length} symbols</span>
        </div>
      </div>
    </div>
  );
};
