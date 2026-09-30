import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useExplorer } from '../context/ExplorerContext';
import type { AnalysisMode } from '../types';
import {
  PanelLeft,
  PanelRight,
  FolderOpen,
  Search,
  RefreshCw,
  ChevronDown,
  Boxes,
  Crosshair,
  RotateCcw,
  AlertTriangle,
  Filter,
} from 'lucide-react';

export const HeaderBar: React.FC = () => {
  const {
    projectPath,
    setProjectPath,
    loadProject,
    nodes,
    edges,
    openSpotlight,
    apiConnected,
    leftPanelOpen,
    setLeftPanelOpen,
    rightPanelOpen,
    setRightPanelOpen,
    focusMode,
    isEditorFocused,
    analysisMode,
    setAnalysisMode,
    depthHops,
    setDepthHops,
    activeLayerFilter,
    setActiveLayerFilter,
    layers,
  } = useExplorer();

  const [exportOpen, setExportOpen] = useState(false);
  const [layerFilterOpen, setLayerFilterOpen] = useState(false);
  const [editingPath, setEditingPath] = useState(false);
  const [tempPath, setTempPath] = useState(projectPath);

  const exportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
      if (layerRef.current && !layerRef.current.contains(e.target as Node)) {
        setLayerFilterOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const repoName = projectPath.split(/[\\/]/).filter(Boolean).pop() || 'python-project';

  const availableLayers = useMemo(() => {
    return Object.keys(layers || {});
  }, [layers]);

  const handleExport = (format: 'svg' | 'json' | 'mmd') => {
    setExportOpen(false);
    if (format === 'json') {
      const dataStr =
        'data:text/json;charset=utf-8,' +
        encodeURIComponent(JSON.stringify({ nodes, edges }, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${repoName}_architecture.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else if (format === 'mmd') {
      let mmd = 'graph TD\n';
      edges.forEach((e) => {
        mmd += `  ${e.source.replace(/[^a-zA-Z0-9_]/g, '_')} --> ${e.target.replace(
          /[^a-zA-Z0-9_]/g,
          '_'
        )}\n`;
      });
      const dataStr = 'data:text/plain;charset=utf-8,' + encodeURIComponent(mmd);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `${repoName}_diagram.mmd`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } else {
      window.print();
    }
  };

  const isDimmed = focusMode || isEditorFocused;

  return (
    <header
      className={`absolute top-2 left-3 right-3 h-10 px-2.5 bg-[#252526] border border-[#3e3e42] rounded-[3px] shadow-lg flex items-center justify-between z-40 select-none transition-all duration-200 ${
        isDimmed ? 'opacity-30 hover:opacity-100' : 'opacity-100'
      }`}
    >
      {/* Left: Project Explorer Toggle, Brand, Folder Picker */}
      <div className="flex items-center space-x-2 flex-shrink-0">
        <button
          onClick={() => setLeftPanelOpen((prev) => !prev)}
          className={`p-1.5 rounded-[3px] micro-tap flex items-center justify-center border ${
            leftPanelOpen
              ? 'text-[#ffffff] bg-[#383838] border-[#007acc]/60'
              : 'text-[#858585] hover:text-[#ffffff] hover:bg-[#383838] border-transparent'
          }`}
          title="Toggle Project Explorer (Ctrl+B)"
        >
          <PanelLeft size={15} />
        </button>

        <div className="flex items-center space-x-1.5 pr-1">
          {/* VS Code iconic logo glyph */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#007acc"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          <span className="font-semibold text-xs text-[#ffffff] tracking-normal font-sans hidden sm:inline">
            Architecture Explorer
          </span>
        </div>

        <div className="h-4 w-[1px] bg-[#3e3e42]" />

        {/* Project Path Chip */}
        {editingPath ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setProjectPath(tempPath);
              setEditingPath(false);
              loadProject(tempPath);
            }}
            className="flex items-center"
          >
            <input
              type="text"
              value={tempPath}
              onChange={(e) => setTempPath(e.target.value)}
              className="bg-[#1e1e1e] border border-[#007acc] rounded-[2px] px-2 py-0.5 text-[11px] font-mono text-[#cccccc] focus:outline-none w-56"
              autoFocus
              onBlur={() => setEditingPath(false)}
            />
          </form>
        ) : (
          <button
            onClick={async () => {
              const pywebview = (window as any).pywebview;
              if (pywebview?.api?.open_folder_dialog) {
                try {
                  const selected = await pywebview.api.open_folder_dialog();
                  if (selected) {
                    setProjectPath(selected);
                    loadProject(selected);
                    return;
                  }
                } catch (e) {
                  console.error(e);
                }
              }
              setTempPath(projectPath);
              setEditingPath(true);
            }}
            className="flex items-center space-x-1.5 px-2 py-0.5 rounded-[3px] hover:bg-[#383838] text-[11px] font-mono text-[#cccccc] hover:text-[#ffffff] micro-tap border border-transparent hover:border-[#3e3e42]"
            title="Open Python Repository / Change Folder"
          >
            <FolderOpen size={13} className="text-[#858585]" />
            <span className="truncate max-w-[140px] font-medium text-[#cccccc]">{repoName}</span>
          </button>
        )}
      </div>

      {/* Center: Unified Analysis Mode Segmented Control (Zero Clutter) */}
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-0.5 bg-[#1e1e1e] p-0.5 rounded-[3px] border border-[#3e3e42]">
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
                className={`px-2.5 py-1 rounded-[2px] text-xs font-sans flex items-center gap-1.5 micro-tap ${
                  active
                    ? 'bg-[#094771] text-[#ffffff] font-medium border border-[#007acc]'
                    : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#282828] border border-transparent'
                }`}
                title={`${label} Analysis Mode`}
              >
                <Icon size={13} />
                <span className="hidden md:inline">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Contextual Depth Slider: ONLY shown in Impact mode */}
        {analysisMode === 'impact' && (
          <div className="flex items-center gap-1 bg-[#1e1e1e] px-1.5 py-1 rounded-[3px] border border-[#3e3e42] text-[11px] font-mono text-[#858585]">
            <span>Hops:</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4].map((d) => (
                <button
                  key={d}
                  onClick={() => setDepthHops(d)}
                  className={`w-4 h-4 rounded-[2px] text-[10px] flex items-center justify-center font-bold micro-tap ${
                    depthHops === d
                      ? 'bg-[#094771] text-[#ffffff] border border-[#007acc]'
                      : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#2a2d2e]'
                  }`}
                  title={`Trace dependencies up to ${d} hops`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right: Quick Search, Layer Filter, Stats, Refresh, Export, Inspector Toggle */}
      <div className="flex items-center space-x-1.5 flex-shrink-0">
        {/* Quick Open Symbol Search Trigger */}
        <button
          onClick={openSpotlight}
          className="flex items-center space-x-1.5 px-2 py-1 bg-[#1e1e1e] hover:bg-[#252526] border border-[#3e3e42] hover:border-[#007acc] rounded-[3px] text-[#858585] hover:text-[#cccccc] text-xs micro-tap"
          title="Search symbols, functions & classes (Ctrl+K)"
        >
          <Search size={13} className="text-[#858585]" />
          <span className="font-mono text-[11px] hidden xl:inline">Search...</span>
          <kbd className="bg-[#2d2d2d] text-[#858585] px-1 py-0.2 rounded-[2px] text-[9px] font-mono border border-[#3e3e42]">
            Ctrl+K
          </kbd>
        </button>

        {/* Architectural Layer Filter Dropdown */}
        {availableLayers.length > 0 && (
          <div className="relative" ref={layerRef}>
            <button
              onClick={() => setLayerFilterOpen((p) => !p)}
              className={`px-2 py-1 rounded-[3px] text-[11px] font-mono flex items-center gap-1 micro-tap border ${
                activeLayerFilter !== 'ALL'
                  ? 'bg-[#094771] text-[#ffffff] border-[#007acc]'
                  : 'bg-[#1e1e1e] text-[#858585] hover:text-[#cccccc] border-[#3e3e42]'
              }`}
              title="Filter by Architectural Layer"
            >
              <Filter size={11} />
              <span className="hidden xl:inline">
                {activeLayerFilter === 'ALL' ? 'All Tiers' : activeLayerFilter}
              </span>
              <ChevronDown size={11} />
            </button>

            {layerFilterOpen && (
              <div className="absolute right-0 mt-1 w-36 bg-[#252526] border border-[#3e3e42] rounded-[3px] shadow-xl py-1 z-50 font-mono text-[11px] overflow-hidden">
                <button
                  onClick={() => {
                    setActiveLayerFilter('ALL');
                    setLayerFilterOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 micro-tap ${
                    activeLayerFilter === 'ALL'
                      ? 'bg-[#094771] text-[#ffffff]'
                      : 'text-[#cccccc] hover:bg-[#2a2d2e]'
                  }`}
                >
                  All Layers
                </button>
                {availableLayers.map((lyr) => (
                  <button
                    key={lyr}
                    onClick={() => {
                      setActiveLayerFilter(lyr);
                      setLayerFilterOpen(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 uppercase micro-tap ${
                      activeLayerFilter === lyr
                        ? 'bg-[#094771] text-[#ffffff]'
                        : 'text-[#cccccc] hover:bg-[#2a2d2e]'
                    }`}
                  >
                    {lyr}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Node count & AST status */}
        <div
          className="hidden 2xl:flex items-center gap-1.5 text-[11px] font-mono text-[#858585] bg-[#1e1e1e] px-2 py-1 rounded-[2px] border border-[#3e3e42]"
          title={`${nodes.length} symbols, ${edges.length} calls extracted`}
        >
          <span className="text-[#cccccc] font-medium">{nodes.length}</span>
          <span>nodes</span>
          <span className="text-[#3e3e42]">•</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              apiConnected ? 'bg-[#4ec9b0]' : 'bg-[#cca700] animate-pulse'
            }`}
          />
        </div>

        {/* Refresh button with force refresh */}
        <button
          onClick={() => loadProject(projectPath, true)}
          className="p-1.5 text-[#cccccc] hover:text-[#ffffff] hover:bg-[#383838] rounded-[3px] micro-tap flex items-center justify-center border border-transparent"
          title="Force Re-analyze Project AST"
        >
          <RefreshCw size={13} />
        </button>

        {/* Export Dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen((p) => !p)}
            className="px-2 py-1 bg-[#1e1e1e] hover:bg-[#252526] text-[#cccccc] hover:text-[#ffffff] border border-[#3e3e42] rounded-[3px] text-xs font-sans flex items-center gap-1 micro-tap"
          >
            <span>Export</span>
            <ChevronDown size={11} />
          </button>

          {exportOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-[#252526] border border-[#3e3e42] rounded-[3px] shadow-xl py-1 z-50 font-sans text-xs overflow-hidden">
              <button
                onClick={() => handleExport('json')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#094771] text-[#cccccc] hover:text-[#ffffff] flex items-center justify-between micro-tap"
              >
                <span>JSON Graph</span>
                <span className="text-[10px] font-mono text-[#858585]">.json</span>
              </button>
              <button
                onClick={() => handleExport('mmd')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#094771] text-[#cccccc] hover:text-[#ffffff] flex items-center justify-between micro-tap"
              >
                <span>Mermaid Diagram</span>
                <span className="text-[10px] font-mono text-[#858585]">.mmd</span>
              </button>
              <button
                onClick={() => handleExport('svg')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#094771] text-[#cccccc] hover:text-[#ffffff] flex items-center justify-between border-t border-[#3e3e42] mt-1 pt-1.5 micro-tap"
              >
                <span>Print / Vector</span>
                <span className="text-[10px] font-mono text-[#858585]">Print</span>
              </button>
            </div>
          )}
        </div>

        {/* Inspector Panel Toggle */}
        <button
          onClick={() => setRightPanelOpen((prev) => !prev)}
          className={`p-1.5 rounded-[3px] micro-tap flex items-center justify-center border ${
            rightPanelOpen
              ? 'text-[#ffffff] bg-[#383838] border-[#007acc]/60'
              : 'text-[#858585] hover:text-[#ffffff] hover:bg-[#383838] border-transparent'
          }`}
          title="Toggle Symbol Inspector (Ctrl+J)"
        >
          <PanelRight size={15} />
        </button>
      </div>
    </header>
  );
};
