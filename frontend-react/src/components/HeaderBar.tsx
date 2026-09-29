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
      className={`absolute top-2 left-3 right-3 h-10 px-3 bg-[#2d2d2d] border border-[#3e3e42] rounded-[3px] shadow-lg flex items-center justify-between z-40 select-none transition-all duration-200 ${
        isDimmed ? 'opacity-30 hover:opacity-100' : 'opacity-100'
      }`}
    >
      {/* Left: Project Explorer Toggle, Brand, Folder Picker */}
      <div className="flex items-center space-x-2">
        <button
          onClick={() => setLeftPanelOpen((prev) => !prev)}
          className={`p-1 rounded-[3px] transition-colors ${
            leftPanelOpen
              ? 'text-[#ffffff] bg-[#094771] border border-[#007acc]'
              : 'text-[#cccccc] hover:text-[#ffffff] hover:bg-[#383838]'
          }`}
          title="Toggle Project Explorer (Ctrl+B)"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            view_sidebar
          </span>
        </button>

        <div className="flex items-center space-x-1.5 pr-2">
          {/* VS Code iconic logo glyph */}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#007acc" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          <span className="font-semibold text-xs text-[#ffffff] tracking-normal font-sans">
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
              className="bg-[#1e1e1e] border border-[#007acc] rounded-[2px] px-2 py-0.5 text-[11px] font-mono text-[#cccccc] focus:outline-none w-72"
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
            className="flex items-center space-x-1.5 px-2 py-0.5 rounded-[3px] hover:bg-[#383838] text-[11px] font-mono text-[#cccccc] hover:text-[#ffffff] transition-colors border border-transparent hover:border-[#3e3e42]"
            title="Open Python Repository / Change Folder"
          >
            <span className="material-symbols-outlined text-[#858585]" style={{ fontSize: 14 }}>
              folder_open
            </span>
            <span className="truncate max-w-[200px] font-medium text-[#cccccc]">{repoName}</span>
            <span className="text-[10px] text-[#858585] hidden sm:inline">({projectPath.slice(-22)})</span>
          </button>
        )}
      </div>

      {/* Center: VS Code Style Quick Open / Command Palette Trigger */}
      <div className="flex items-center justify-center flex-1 max-w-md mx-3">
        <button
          onClick={openSpotlight}
          className="w-full flex items-center justify-between px-3 py-1 bg-[#1e1e1e] hover:bg-[#252526] border border-[#3e3e42] hover:border-[#007acc] rounded-[3px] text-[#858585] hover:text-[#cccccc] text-xs transition-colors group"
          title="Search symbols, functions & classes (Ctrl+K)"
        >
          <div className="flex items-center space-x-2 truncate">
            <span
              className="material-symbols-outlined text-[#858585] group-hover:text-[#007acc]"
              style={{ fontSize: 13 }}
            >
              search
            </span>
            <span className="font-mono text-[11px] truncate">Search symbols, functions, classes...</span>
          </div>
          <kbd className="bg-[#2d2d2d] text-[#858585] group-hover:text-[#cccccc] px-1.5 py-0.2 rounded-[2px] text-[10px] font-mono border border-[#3e3e42]">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Stats, Re-analyze, Export, Inspector Toggle */}
      <div className="flex items-center space-x-2">
        {/* Node & Edge Counts */}
        <div className="hidden md:flex items-center space-x-2 text-[11px] font-mono text-[#858585] bg-[#1e1e1e] px-2 py-0.5 rounded-[2px] border border-[#3e3e42]">
          <span className="text-[#cccccc] font-medium">{nodes.length}</span>
          <span>nodes</span>
          <span className="text-[#3e3e42]">•</span>
          <span className="text-[#cccccc] font-medium">{edges.length}</span>
          <span>calls</span>
        </div>

        {/* API connection indicator */}
        <div
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-[2px] text-[10px] font-mono ${
            apiConnected ? 'text-[#4ec9b0]' : 'text-[#cca700]'
          }`}
          title={apiConnected ? 'AST Engine Connected' : 'AST Engine Offline / Connecting...'}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              apiConnected ? 'bg-[#4ec9b0]' : 'bg-[#cca700] animate-pulse'
            }`}
          />
          <span className="hidden xl:inline">{apiConnected ? 'AST Ready' : 'Connecting'}</span>
        </div>

        {/* Refresh button with force refresh */}
        <button
          onClick={() => loadProject(projectPath, true)}
          className="p-1 text-[#cccccc] hover:text-[#ffffff] hover:bg-[#383838] rounded-[3px] transition-colors"
          title="Force Re-analyze Project AST (Clears Cache)"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
            refresh
          </span>
        </button>

        {/* Export Dropdown */}
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen((p) => !p)}
            className="px-2 py-0.5 bg-[#333333] hover:bg-[#3e3e42] text-[#cccccc] hover:text-[#ffffff] border border-[#3e3e42] rounded-[3px] text-[11px] font-sans flex items-center gap-1 transition-colors"
          >
            <span>Export</span>
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              arrow_drop_down
            </span>
          </button>

          {exportOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-[#252526] border border-[#3e3e42] rounded-[3px] shadow-xl py-1 z-50 font-sans text-xs overflow-hidden">
              <button
                onClick={() => handleExport('json')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#094771] text-[#cccccc] hover:text-[#ffffff] flex items-center justify-between"
              >
                <span>JSON Graph</span>
                <span className="text-[10px] font-mono text-[#858585]">.json</span>
              </button>
              <button
                onClick={() => handleExport('mmd')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#094771] text-[#cccccc] hover:text-[#ffffff] flex items-center justify-between"
              >
                <span>Mermaid Diagram</span>
                <span className="text-[10px] font-mono text-[#858585]">.mmd</span>
              </button>
              <button
                onClick={() => handleExport('svg')}
                className="w-full text-left px-3 py-1.5 hover:bg-[#094771] text-[#cccccc] hover:text-[#ffffff] flex items-center justify-between border-t border-[#3e3e42] mt-1 pt-1.5"
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
          className={`p-1 rounded-[3px] transition-colors ${
            rightPanelOpen
              ? 'text-[#ffffff] bg-[#094771] border border-[#007acc]'
              : 'text-[#cccccc] hover:text-[#ffffff] hover:bg-[#383838]'
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
