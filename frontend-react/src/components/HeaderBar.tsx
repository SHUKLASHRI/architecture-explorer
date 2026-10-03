import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useExplorer } from '../context/ExplorerContext';
import {
  PanelLeft,
  PanelRight,
  PanelBottom,
  Search,
  Settings,
  Globe,
  ChevronDown,
  Play,
  Sparkles,
  LayoutGrid,
  Minus,
  Square,
  X,
} from 'lucide-react';
import { IrminsulLogo } from './IrminsulLogo';

type MenuId = 'file' | 'edit' | 'selection' | 'view' | 'go' | 'run' | 'terminal' | 'help' | 'profile' | null;

export const HeaderBar: React.FC = () => {
  const {
    projectPath,
    setProjectPath,
    loadProject,
    openSpotlight,
    leftPanelOpen,
    setLeftPanelOpen,
    rightPanelOpen,
    setRightPanelOpen,
    isBottomPanelOpen,
    toggleBottomPanel,
    focusMode,
    toggleFocusMode,
    setAnalysisMode,
    selectedNode,
    openSettings,
    openWelcome,
    resetZoom,
    recentProjects,
  } = useExplorer();

  const [activeMenu, setActiveMenu] = useState<MenuId>(null);
  const menuBarRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const repoName = useMemo(() => {
    return projectPath.split(/[\\/]/).filter(Boolean).pop() || 'project';
  }, [projectPath]);

  const activeDocName = selectedNode ? selectedNode.name : 'Architecture Graph';

  const handleOpenFolder = async () => {
    setActiveMenu(null);
    const pyApi = (window as any).pywebview?.api;
    if (pyApi && pyApi.open_folder_dialog) {
      try {
        const selected = await pyApi.open_folder_dialog();
        if (selected) {
          setProjectPath(selected);
          loadProject(selected);
        }
      } catch (err) {
        console.error('Folder picker error:', err);
      }
    } else {
      const path = prompt('Enter project directory path:', projectPath);
      if (path) {
        setProjectPath(path);
        loadProject(path);
      }
    }
  };

  const handleMinimize = () => {
    const pyApi = (window as any).pywebview?.api;
    if (pyApi?.minimize_window) pyApi.minimize_window();
  };

  const handleMaximize = () => {
    const pyApi = (window as any).pywebview?.api;
    if (pyApi?.toggle_maximize_window) pyApi.toggle_maximize_window();
  };

  const handleClose = () => {
    const pyApi = (window as any).pywebview?.api;
    if (pyApi?.close_window) {
      pyApi.close_window();
    } else {
      window.close();
    }
  };

  return (
    <header
      ref={menuBarRef}
      className="h-[36px] bg-[#1e1e1e] border-b border-[#333333] px-2 flex items-center justify-between z-30 select-none font-sans text-xs relative"
    >
      {/* LEFT: App Logo + VS Code Menu Bar (File, Edit, Selection, View, Go, Run, Terminal, Help) */}
      <div className="flex items-center space-x-1">
        {/* App Logo */}
        <div
          onClick={openWelcome}
          className="flex items-center px-1.5 py-1 rounded hover:bg-[#2d2d2d] cursor-pointer mr-0.5 group"
          title="Irminsul IDE - Click for Welcome & Guide"
        >
          <IrminsulLogo className="w-4 h-4 filter drop-shadow-[0_0_6px_rgba(255,255,255,0.4)] group-hover:scale-110 transition-transform" />
        </div>

        {/* 1. FILE MENU */}
        <div className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
            onMouseEnter={() => activeMenu && setActiveMenu('file')}
            className={`px-2 py-1 rounded text-[12px] transition-colors ${
              activeMenu === 'file' ? 'bg-[#383838] text-[#ffffff]' : 'text-[#cccccc] hover:bg-[#2d2d2d]'
            }`}
          >
            File
          </button>
          {activeMenu === 'file' && (
            <div className="absolute left-0 top-[32px] w-64 bg-[#252526] border border-[#3e3e42] rounded shadow-2xl py-1 z-50 text-xs text-[#cccccc]">
              <button
                onClick={handleOpenFolder}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Open Folder...</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+O</span>
              </button>
              <button
                onClick={() => {
                  loadProject('sample_project');
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Open Sample Architecture</span>
                <span className="text-[10px] text-[#858585] font-mono">Demo</span>
              </button>

              {/* Recent submenu */}
              <div className="border-t border-[#333333] my-1" />
              <div className="px-3 py-1 text-[10px] text-[#858585] uppercase tracking-wider font-semibold">
                Recent Projects
              </div>
              {recentProjects.slice(0, 4).map((p) => (
                <button
                  key={p.path}
                  onClick={() => {
                    loadProject(p.path);
                    setActiveMenu(null);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1 hover:bg-[#094771] hover:text-[#ffffff] text-left text-[11px]"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="text-[9px] text-[#6e6e6e] font-mono">{p.lastOpened}</span>
                </button>
              ))}

              <div className="border-t border-[#333333] my-1" />
              <button
                onClick={() => {
                  loadProject(projectPath, true);
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Re-analyze Codebase</span>
                <span className="text-[10px] text-[#858585] font-mono">F5</span>
              </button>
              <button
                onClick={() => {
                  openSettings();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Preferences: Settings</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+,</span>
              </button>
              <div className="border-t border-[#333333] my-1" />
              <button
                onClick={handleClose}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Close Window</span>
                <span className="text-[10px] text-[#858585] font-mono">Alt+F4</span>
              </button>
            </div>
          )}
        </div>

        {/* 2. EDIT MENU */}
        <div className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === 'edit' ? null : 'edit')}
            onMouseEnter={() => activeMenu && setActiveMenu('edit')}
            className={`px-2 py-1 rounded text-[12px] transition-colors ${
              activeMenu === 'edit' ? 'bg-[#383838] text-[#ffffff]' : 'text-[#cccccc] hover:bg-[#2d2d2d]'
            }`}
          >
            Edit
          </button>
          {activeMenu === 'edit' && (
            <div className="absolute left-0 top-[32px] w-60 bg-[#252526] border border-[#3e3e42] rounded shadow-2xl py-1 z-50 text-xs text-[#cccccc]">
              <button
                onClick={() => {
                  openSpotlight();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Find Symbol in Architecture</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+F</span>
              </button>
              <button
                onClick={() => {
                  openSpotlight();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Quick Search / Go to Symbol</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+P</span>
              </button>
              <div className="border-t border-[#333333] my-1" />
              <button
                onClick={() => {
                  resetZoom();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Reset Viewport Zoom</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+0</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. SELECTION MENU */}
        <div className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === 'selection' ? null : 'selection')}
            onMouseEnter={() => activeMenu && setActiveMenu('selection')}
            className={`px-2 py-1 rounded text-[12px] transition-colors ${
              activeMenu === 'selection' ? 'bg-[#383838] text-[#ffffff]' : 'text-[#cccccc] hover:bg-[#2d2d2d]'
            }`}
          >
            Selection
          </button>
          {activeMenu === 'selection' && (
            <div className="absolute left-0 top-[32px] w-64 bg-[#252526] border border-[#3e3e42] rounded shadow-2xl py-1 z-50 text-xs text-[#cccccc]">
              <button
                onClick={() => {
                  setAnalysisMode('default');
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Select All Modules</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+A</span>
              </button>
              <button
                onClick={() => {
                  setAnalysisMode('impact');
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Trace Upstream Callers</span>
                <span className="text-[10px] text-[#858585] font-mono">Impact</span>
              </button>
              <button
                onClick={() => {
                  setAnalysisMode('cycles');
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Highlight Cycle Loops</span>
                <span className="text-[10px] text-[#858585] font-mono">Cycles</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. VIEW MENU */}
        <div className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === 'view' ? null : 'view')}
            onMouseEnter={() => activeMenu && setActiveMenu('view')}
            className={`px-2 py-1 rounded text-[12px] transition-colors ${
              activeMenu === 'view' ? 'bg-[#383838] text-[#ffffff]' : 'text-[#cccccc] hover:bg-[#2d2d2d]'
            }`}
          >
            View
          </button>
          {activeMenu === 'view' && (
            <div className="absolute left-0 top-[32px] w-64 bg-[#252526] border border-[#3e3e42] rounded shadow-2xl py-1 z-50 text-xs text-[#cccccc]">
              <button
                onClick={() => {
                  openSpotlight();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Command Palette...</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+Shift+P</span>
              </button>
              <div className="border-t border-[#333333] my-1" />
              <button
                onClick={() => {
                  setLeftPanelOpen((p) => !p);
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Toggle Primary Sidebar</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+B</span>
              </button>
              <button
                onClick={() => {
                  setRightPanelOpen((p) => !p);
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Toggle Secondary Inspector</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+J</span>
              </button>
              <button
                onClick={() => {
                  toggleBottomPanel();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Toggle Bottom Terminal</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+`</span>
              </button>
              <button
                onClick={() => {
                  toggleFocusMode();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Toggle Focus Mode</span>
                <span className="text-[10px] text-[#858585] font-mono">F11</span>
              </button>
              <div className="border-t border-[#333333] my-1" />
              <button
                onClick={() => {
                  openWelcome();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Welcome & Guide</span>
                <span className="text-[10px] text-[#858585] font-mono">Start</span>
              </button>
            </div>
          )}
        </div>

        {/* 5. GO MENU */}
        <div className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === 'go' ? null : 'go')}
            onMouseEnter={() => activeMenu && setActiveMenu('go')}
            className={`px-2 py-1 rounded text-[12px] transition-colors ${
              activeMenu === 'go' ? 'bg-[#383838] text-[#ffffff]' : 'text-[#cccccc] hover:bg-[#2d2d2d]'
            }`}
          >
            Go
          </button>
          {activeMenu === 'go' && (
            <div className="absolute left-0 top-[32px] w-60 bg-[#252526] border border-[#3e3e42] rounded shadow-2xl py-1 z-50 text-xs text-[#cccccc]">
              <button
                onClick={() => {
                  openSpotlight();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Go to Symbol...</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+P</span>
              </button>
              <button
                onClick={() => {
                  setAnalysisMode('cycles');
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Go to Next Circular Dependency</span>
                <span className="text-[10px] text-[#858585] font-mono">F8</span>
              </button>
              <button
                onClick={() => {
                  setAnalysisMode('deadcode');
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Go to Dead Code Candidate</span>
                <span className="text-[10px] text-[#858585] font-mono">Shift+F8</span>
              </button>
            </div>
          )}
        </div>

        {/* 6. RUN MENU */}
        <div className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === 'run' ? null : 'run')}
            onMouseEnter={() => activeMenu && setActiveMenu('run')}
            className={`px-2 py-1 rounded text-[12px] transition-colors ${
              activeMenu === 'run' ? 'bg-[#383838] text-[#ffffff]' : 'text-[#cccccc] hover:bg-[#2d2d2d]'
            }`}
          >
            Run
          </button>
          {activeMenu === 'run' && (
            <div className="absolute left-0 top-[32px] w-64 bg-[#252526] border border-[#3e3e42] rounded shadow-2xl py-1 z-50 text-xs text-[#cccccc]">
              <button
                onClick={() => {
                  loadProject(projectPath, true);
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <div className="flex items-center gap-2">
                  <Play size={13} className="text-[#4ec9b0]" />
                  <span>Start Full Architecture Audit</span>
                </div>
                <span className="text-[10px] text-[#858585] font-mono">F5</span>
              </button>
              <button
                onClick={() => {
                  toggleBottomPanel();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Run Tests in Terminal</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+`</span>
              </button>
            </div>
          )}
        </div>

        {/* 7. TERMINAL MENU */}
        <div className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === 'terminal' ? null : 'terminal')}
            onMouseEnter={() => activeMenu && setActiveMenu('terminal')}
            className={`px-2 py-1 rounded text-[12px] transition-colors ${
              activeMenu === 'terminal' ? 'bg-[#383838] text-[#ffffff]' : 'text-[#cccccc] hover:bg-[#2d2d2d]'
            }`}
          >
            Terminal
          </button>
          {activeMenu === 'terminal' && (
            <div className="absolute left-0 top-[32px] w-60 bg-[#252526] border border-[#3e3e42] rounded shadow-2xl py-1 z-50 text-xs text-[#cccccc]">
              <button
                onClick={() => {
                  toggleBottomPanel();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>New Terminal</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+`</span>
              </button>
              <button
                onClick={() => {
                  toggleBottomPanel();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Run Python File</span>
                <span className="text-[10px] text-[#858585] font-mono">Terminal</span>
              </button>
            </div>
          )}
        </div>

        {/* 8. HELP MENU */}
        <div className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === 'help' ? null : 'help')}
            onMouseEnter={() => activeMenu && setActiveMenu('help')}
            className={`px-2 py-1 rounded text-[12px] transition-colors ${
              activeMenu === 'help' ? 'bg-[#383838] text-[#ffffff]' : 'text-[#cccccc] hover:bg-[#2d2d2d]'
            }`}
          >
            Help
          </button>
          {activeMenu === 'help' && (
            <div className="absolute left-0 top-[32px] w-64 bg-[#252526] border border-[#3e3e42] rounded shadow-2xl py-1 z-50 text-xs text-[#cccccc]">
              <button
                onClick={() => {
                  openWelcome();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <div className="flex items-center gap-2">
                  <Sparkles size={13} className="text-[#cca700]" />
                  <span>Welcome: How Everything Works</span>
                </div>
              </button>
              <button
                onClick={() => {
                  openSettings();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>Keyboard Shortcuts Reference</span>
                <span className="text-[10px] text-[#858585] font-mono">Ctrl+,</span>
              </button>
              <div className="border-t border-[#333333] my-1" />
              <a
                href="https://github.com/SHUKLASHRI/architecture-explorer"
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>GitHub Repository</span>
                <Globe size={13} />
              </a>
              <button
                onClick={() => {
                  alert('Irminsul IDE v1.0.0\nPython AST Architecture & Refactoring Workbench\nPowered by PyWebView, Monaco, and React.');
                  setActiveMenu(null);
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <span>About Irminsul IDE</span>
                <span className="text-[10px] text-[#858585]">v1.0.0</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* CENTER: Exact VS Code Centered Title Box (architecture-explorer - Irminsul IDE - active_doc) */}
      <div className="flex-1 max-w-xl mx-4 flex items-center justify-center">
        <button
          onClick={openSpotlight}
          className="w-full max-w-md h-[24px] bg-[#252526] hover:bg-[#2d2d2d] border border-[#3e3e42] hover:border-[#007acc] rounded px-3 flex items-center justify-center gap-2 text-[11px] text-[#cccccc] transition-colors shadow-inner group"
          title="Quick Open / Search (Ctrl+P)"
        >
          <Search size={12} className="text-[#858585] group-hover:text-[#007acc] transition-colors" />
          <span className="truncate">
            <span className="text-[#ffffff] font-medium">{repoName}</span>
            <span className="text-[#6e6e6e] mx-1.5">—</span>
            <span className="text-[#007acc] font-medium">Irminsul IDE</span>
            <span className="text-[#6e6e6e] mx-1.5">—</span>
            <span className="text-[#858585] font-mono text-[10px]">{activeDocName}</span>
          </span>
        </button>
      </div>

      {/* RIGHT: Layout Toggles, Search, Globe, Settings, Avatar, Window Controls */}
      <div className="flex items-center space-x-1">
        {/* Toggle Left Sidebar */}
        <button
          onClick={() => setLeftPanelOpen((p) => !p)}
          className={`p-1.5 rounded hover:bg-[#333333] transition-colors ${
            leftPanelOpen ? 'text-[#007acc]' : 'text-[#858585]'
          }`}
          title="Toggle Primary Sidebar (Ctrl+B)"
        >
          <PanelLeft size={14} />
        </button>

        {/* Toggle Bottom Panel */}
        <button
          onClick={toggleBottomPanel}
          className={`p-1.5 rounded hover:bg-[#333333] transition-colors ${
            isBottomPanelOpen ? 'text-[#007acc]' : 'text-[#858585]'
          }`}
          title="Toggle Bottom Terminal (Ctrl+`)"
        >
          <PanelBottom size={14} />
        </button>

        {/* Toggle Right Inspector */}
        <button
          onClick={() => setRightPanelOpen((p) => !p)}
          className={`p-1.5 rounded hover:bg-[#333333] transition-colors ${
            rightPanelOpen ? 'text-[#007acc]' : 'text-[#858585]'
          }`}
          title="Toggle Secondary Inspector (Ctrl+J)"
        >
          <PanelRight size={14} />
        </button>

        {/* Toggle Focus Mode */}
        <button
          onClick={toggleFocusMode}
          className={`p-1.5 rounded hover:bg-[#333333] transition-colors ${
            focusMode ? 'text-[#4ec9b0]' : 'text-[#858585]'
          }`}
          title="Toggle Focus / Fullscreen Mode (F11)"
        >
          <LayoutGrid size={14} />
        </button>

        <div className="h-3 w-[1px] bg-[#3e3e42] mx-1" />

        {/* Search button */}
        <button
          onClick={openSpotlight}
          className="p-1.5 rounded text-[#858585] hover:text-[#ffffff] hover:bg-[#333333] transition-colors"
          title="Search / Command Palette (Ctrl+Shift+P)"
        >
          <Search size={14} />
        </button>

        {/* Web / Releases button */}
        <a
          href="https://github.com/SHUKLASHRI/architecture-explorer"
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded text-[#858585] hover:text-[#ffffff] hover:bg-[#333333] transition-colors"
          title="View Releases & Downloads"
        >
          <Globe size={14} />
        </a>

        {/* Settings gear button */}
        <button
          onClick={openSettings}
          className="p-1.5 rounded text-[#858585] hover:text-[#ffffff] hover:bg-[#333333] transition-colors"
          title="Settings (Ctrl+,)"
        >
          <Settings size={14} />
        </button>

        {/* User Profile Avatar with dropdown */}
        <div className="relative">
          <button
            onClick={() => setActiveMenu(activeMenu === 'profile' ? null : 'profile')}
            className="flex items-center gap-1 pl-1 pr-1.5 py-0.5 rounded hover:bg-[#333333] transition-colors text-[#cccccc]"
            title="Accounts & Profile"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#007acc] to-[#4ec9b0] flex items-center justify-center text-[10px] font-bold text-[#ffffff] shadow-sm">
              I
            </div>
            <ChevronDown size={11} className="text-[#858585]" />
          </button>
          {activeMenu === 'profile' && (
            <div className="absolute right-0 top-[32px] w-56 bg-[#252526] border border-[#3e3e42] rounded shadow-2xl py-1 z-50 text-xs text-[#cccccc]">
              <div className="px-3 py-2 border-b border-[#333333]">
                <div className="font-semibold text-[#ffffff]">Irminsul Developer</div>
                <div className="text-[10px] text-[#858585] truncate">Python 3.12 Engine Active</div>
              </div>
              <button
                onClick={() => {
                  openWelcome();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <Sparkles size={13} className="text-[#cca700]" />
                <span>Getting Started Walkthrough</span>
              </button>
              <button
                onClick={() => {
                  openSettings();
                  setActiveMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#094771] hover:text-[#ffffff] text-left"
              >
                <Settings size={13} />
                <span>Manage Settings</span>
              </button>
            </div>
          )}
        </div>

        <div className="h-3 w-[1px] bg-[#3e3e42] mx-1" />

        {/* NATIVE WINDOW CONTROLS: Minimize, Maximize, Close */}
        <div className="flex items-center space-x-0.5">
          <button
            onClick={handleMinimize}
            className="w-7 h-6 flex items-center justify-center text-[#858585] hover:text-[#ffffff] hover:bg-[#333333] rounded transition-colors"
            title="Minimize"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={handleMaximize}
            className="w-7 h-6 flex items-center justify-center text-[#858585] hover:text-[#ffffff] hover:bg-[#333333] rounded transition-colors"
            title="Maximize / Restore"
          >
            <Square size={11} />
          </button>
          <button
            onClick={handleClose}
            className="w-7 h-6 flex items-center justify-center text-[#858585] hover:text-[#ffffff] hover:bg-[#e81123] rounded transition-colors"
            title="Close"
          >
            <X size={13} />
          </button>
        </div>
      </div>
    </header>
  );
};
