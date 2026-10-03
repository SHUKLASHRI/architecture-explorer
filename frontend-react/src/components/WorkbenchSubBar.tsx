import React, { useState, useRef, useEffect } from 'react';
import { useExplorer } from '../context/ExplorerContext';
import type { AnalysisMode } from '../types';
import {
  Boxes,
  Crosshair,
  RotateCcw,
  AlertTriangle,
  Filter,
  RefreshCw,
  Download,
  ChevronDown,
} from 'lucide-react';

export const WorkbenchSubBar: React.FC = () => {
  const {
    analysisMode,
    setAnalysisMode,
    depthHops,
    setDepthHops,
    activeLayerFilter,
    setActiveLayerFilter,
    layers,
    nodes,
    edges,
    loadProject,
    projectPath,
    isLoading,
  } = useExplorer();

  const [layerFilterOpen, setLayerFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const layerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (layerRef.current && !layerRef.current.contains(e.target as Node)) {
        setLayerFilterOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, []);

  const handleExport = (format: 'json' | 'dot') => {
    setExportOpen(false);
    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ nodes, edges }, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `irminsul_architecture_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      let dot = 'digraph G {\n  rankdir=LR;\n  node [shape=box, style=rounded, fontname="Segoe UI"];\n';
      nodes.forEach((n) => {
        dot += `  "${n.id}" [label="${n.name}\\n(${n.kind})"];\n`;
      });
      edges.forEach((e) => {
        dot += `  "${e.source}" -> "${e.target}" [label="${e.type}"];\n`;
      });
      dot += '}\n';
      const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(dot);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `irminsul_architecture_${Date.now()}.dot`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    }
  };

  return (
    <div className="h-[28px] bg-[#252526] border-b border-[#333333] px-3 flex items-center justify-between text-xs font-sans select-none z-20">
      {/* Left: Analysis Modes */}
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-[#858585] uppercase tracking-wider font-semibold mr-1 hidden sm:inline">
          Mode:
        </span>
        <div className="flex items-center bg-[#1e1e1e] p-0.5 rounded border border-[#3e3e42]">
          {(
            [
              { id: 'default', label: 'Architecture', Icon: Boxes },
              { id: 'impact', label: 'Impact', Icon: Crosshair },
              { id: 'cycles', label: 'Cycles', Icon: RotateCcw },
              { id: 'deadcode', label: 'Dead Code', Icon: AlertTriangle },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = analysisMode === id;
            return (
              <button
                key={id}
                onClick={() => setAnalysisMode(id as AnalysisMode)}
                className={`px-2 py-0.5 rounded-[2px] text-[11px] font-sans flex items-center gap-1 transition-colors ${
                  active
                    ? 'bg-[#094771] text-[#ffffff] font-medium border border-[#007acc]'
                    : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#282828] border border-transparent'
                }`}
              >
                <Icon size={12} className={active ? 'text-[#007acc]' : ''} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Hops control for Impact mode */}
        {analysisMode === 'impact' && (
          <div className="flex items-center gap-1 ml-2 bg-[#1e1e1e] px-2 py-0.5 rounded border border-[#3e3e42] text-[10px] font-mono text-[#858585]">
            <span>Hops:</span>
            {[1, 2, 3, 4].map((d) => (
              <button
                key={d}
                onClick={() => setDepthHops(d)}
                className={`w-4 h-4 rounded text-[10px] flex items-center justify-center font-bold ${
                  depthHops === d
                    ? 'bg-[#094771] text-[#ffffff] border border-[#007acc]'
                    : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#2a2d2e]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Layer filter, Graph stats, Export, Rescan */}
      <div className="flex items-center gap-2">
        {/* Layer Filter Dropdown */}
        <div className="relative" ref={layerRef}>
          <button
            onClick={() => setLayerFilterOpen(!layerFilterOpen)}
            className="flex items-center gap-1 px-2 py-0.5 bg-[#1e1e1e] hover:bg-[#2d2d2d] border border-[#3e3e42] rounded text-[11px] text-[#cccccc] transition-colors"
          >
            <Filter size={11} className="text-[#858585]" />
            <span className="capitalize">{activeLayerFilter === 'ALL' ? 'All Layers' : activeLayerFilter}</span>
            <ChevronDown size={10} className="text-[#858585]" />
          </button>
          {layerFilterOpen && (
            <div className="absolute right-0 top-[26px] w-44 bg-[#252526] border border-[#3e3e42] rounded shadow-2xl py-1 z-50 text-xs">
              <button
                onClick={() => {
                  setActiveLayerFilter('ALL');
                  setLayerFilterOpen(false);
                }}
                className={`w-full text-left px-3 py-1 text-[11px] hover:bg-[#094771] hover:text-[#ffffff] ${
                  activeLayerFilter === 'ALL' ? 'text-[#007acc] font-medium' : 'text-[#cccccc]'
                }`}
              >
                All Layers ({nodes.length} nodes)
              </button>
              {Object.entries(layers).map(([layerName, nodeIds]) => (
                <button
                  key={layerName}
                  onClick={() => {
                    setActiveLayerFilter(layerName);
                    setLayerFilterOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1 text-[11px] capitalize hover:bg-[#094771] hover:text-[#ffffff] ${
                    activeLayerFilter === layerName ? 'text-[#007acc] font-medium' : 'text-[#cccccc]'
                  }`}
                >
                  {layerName} ({nodeIds.length})
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export Dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="flex items-center gap-1 px-2 py-0.5 bg-[#1e1e1e] hover:bg-[#2d2d2d] border border-[#3e3e42] rounded text-[11px] text-[#cccccc] transition-colors"
          >
            <Download size={11} className="text-[#858585]" />
            <span>Export</span>
          </button>
          {exportOpen && (
            <div className="absolute right-0 top-[26px] w-40 bg-[#252526] border border-[#3e3e42] rounded shadow-2xl py-1 z-50 text-xs">
              <button
                onClick={() => handleExport('json')}
                className="w-full text-left px-3 py-1.5 text-[11px] text-[#cccccc] hover:bg-[#094771] hover:text-[#ffffff]"
              >
                Export JSON AST
              </button>
              <button
                onClick={() => handleExport('dot')}
                className="w-full text-left px-3 py-1.5 text-[11px] text-[#cccccc] hover:bg-[#094771] hover:text-[#ffffff]"
              >
                Export DOT Graph
              </button>
            </div>
          )}
        </div>

        {/* Rescan Button */}
        <button
          onClick={() => loadProject(projectPath, true)}
          disabled={isLoading}
          className="p-1 text-[#858585] hover:text-[#ffffff] hover:bg-[#2d2d2d] rounded transition-colors disabled:opacity-40"
          title="Refresh Analysis (F5)"
        >
          <RefreshCw size={12} className={isLoading ? 'animate-spin text-[#007acc]' : ''} />
        </button>

        {/* Node/Edge Counter Pill */}
        <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-[#858585] border-l border-[#3e3e42] pl-2">
          <span>{nodes.length} symbols</span>
          <span>•</span>
          <span>{edges.length} calls</span>
        </div>
      </div>
    </div>
  );
};
