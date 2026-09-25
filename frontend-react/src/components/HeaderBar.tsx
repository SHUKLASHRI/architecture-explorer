import React, { useState, useRef, useEffect } from 'react';
import { useExplorer } from '../context/ExplorerContext';

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
  } = useExplorer();

  const [exportOpen, setExportOpen] = useState(false);
  const [editingPath, setEditingPath] = useState(false);
  const [tempPath, setTempPath] = useState(projectPath);
  const exportRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const repoName = projectPath.split(/[\\/]/).filter(Boolean).pop() || 'python-project';

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
      className={`absolute top-2.5 left-4 right-4 h-11 px-3.5 bg-[#0e0e13]/85 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl flex items-center justify-between z-40 select-none transition-all duration-300 ${
        isDimmed ? 'opacity-30 hover:opacity-100' : 'opacity-100'
      }`}
    >
      {/* Left: Project Explorer Toggle, Brand, Folder Picker */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={() => setLeftPanelOpen((prev) => !prev)}
          className={`p-1.5 rounded-xl transition-all ${
            leftPanelOpen
              ? 'text-blue-400 bg-blue-500/15 border border-blue-500/30'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
          }`}
          title="Toggle Project Explorer (Ctrl+B)"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            view_sidebar
          </span>
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              polyline
            </span>
          </div>
          <span className="font-semibold text-xs text-zinc-100 tracking-tight">
            PyArch Studio
          </span>
        </div>

        <div className="h-3.5 w-[1px] bg-zinc-800" />

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
              className="bg-[#14141c] border border-blue-500/50 rounded-lg px-2 py-0.5 text-[11px] font-mono text-zinc-200 focus:outline-none w-72"
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
            className="flex items-center space-x-1.5 px-2.5 py-1 rounded-xl hover:bg-zinc-800/60 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 transition-colors border border-transparent hover:border-white/5"
            title="Open Python Repository / Change Folder"
          >
            <span className="material-symbols-outlined text-zinc-500" style={{ fontSize: 14 }}>
              folder_open
            </span>
            <span className="truncate max-w-[220px] font-medium text-zinc-300">{repoName}</span>
            <span className="text-[10px] text-zinc-500 hidden sm:inline">({projectPath.slice(-25)})</span>
          </button>
        )}
      </div>

      {/* Center: Quick Search Command Bar */}
      <div className="flex items-center">
        <button
          onClick={openSpotlight}
          className="flex items-center space-x-2 px-3 py-1 bg-[#14141c] hover:bg-[#181824] border border-white/5 hover:border-white/10 rounded-xl text-zinc-400 hover:text-zinc-200 text-xs transition-all shadow-sm group"
          title="Search symbols, functions & classes (Ctrl+K)"
        >
          <span
            className="material-symbols-outlined text-zinc-500 group-hover:text-zinc-300"
            style={{ fontSize: 14 }}
          >
            search
          </span>
          <span className="font-mono text-[11px]">Search symbols...</span>
          <kbd className="bg-zinc-800 text-zinc-400 px-1.5 py-0.2 rounded text-[10px] font-mono border border-white/5">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right: Stats, Re-analyze, Export, Inspector Toggle */}
      <div className="flex items-center space-x-2">
        {/* Node & Edge Counts */}
        <div className="hidden md:flex items-center space-x-2 text-[11px] font-mono text-zinc-400 bg-[#14141c] px-2.5 py-1 rounded-xl border border-white/5">
          <span>{nodes.length} nodes</span>
          <span className="text-zinc-600">•</span>
          <span>{edges.length} calls</span>
        </div>

        {/* API connection indicator */}
        <div
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono ${
            apiConnected ? 'text-emerald-400' : 'text-amber-400'
          }`}
          title={apiConnected ? 'Flask Backend Connected' : 'Connecting to AST engine...'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              apiConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
            }`}
          />
        </div>

        <button
          onClick={() => loadProject()}
          className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-xl transition-colors"
          title="Re-analyze Python AST (Ctrl+R)"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            refresh
          </span>
        </button>

        {/* Export Dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen((p) => !p)}
            className="px-2.5 py-1 bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 border border-white/5 rounded-xl text-[11px] font-medium flex items-center gap-1 transition-colors"
          >
            <span>Export</span>
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              arrow_drop_down
            </span>
          </button>

          {exportOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-[#14141c] border border-white/10 rounded-xl shadow-2xl py-1 z-50 font-mono text-xs overflow-hidden backdrop-blur-2xl">
              <button
                onClick={() => handleExport('json')}
                className="w-full text-left px-3 py-1.5 hover:bg-zinc-800/60 text-zinc-300 flex items-center justify-between"
              >
                <span>JSON Graph</span>
                <span className="text-[10px] text-zinc-500">.json</span>
              </button>
              <button
                onClick={() => handleExport('mmd')}
                className="w-full text-left px-3 py-1.5 hover:bg-zinc-800/60 text-zinc-300 flex items-center justify-between"
              >
                <span>Mermaid Diagram</span>
                <span className="text-[10px] text-zinc-500">.mmd</span>
              </button>
              <button
                onClick={() => handleExport('svg')}
                className="w-full text-left px-3 py-1.5 hover:bg-zinc-800/60 text-zinc-300 flex items-center justify-between border-t border-white/5 mt-1 pt-1.5"
              >
                <span>Print / Vector</span>
                <span className="text-[10px] text-zinc-500">Print</span>
              </button>
            </div>
          )}
        </div>

        {/* Inspector Panel Toggle */}
        <button
          onClick={() => setRightPanelOpen((prev) => !prev)}
          className={`p-1.5 rounded-xl transition-all ${
            rightPanelOpen
              ? 'text-blue-400 bg-blue-500/15 border border-blue-500/30'
              : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
          }`}
          title="Toggle Symbol Inspector (Ctrl+J)"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            dock_to_left
          </span>
        </button>
      </div>
    </header>
  );
};
