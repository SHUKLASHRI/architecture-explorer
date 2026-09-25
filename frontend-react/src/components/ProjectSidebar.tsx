import React, { useState, useMemo } from 'react';
import { useExplorer } from '../context/ExplorerContext';
import type { SidebarTab } from '../types';

export const ProjectSidebar: React.FC = () => {
  const {
    nodes,
    selectedNode,
    selectNode,
    selectNodeById,
    sidebarWidth,
    sidebarTab,
    setSidebarTab,
    leftPanelOpen,
    setLeftPanelOpen,
    leftPanelHovered,
    setLeftPanelHovered,
    projectPath,
    modules,
    layers,
    diagnostics,
    projectMeta,
    activeCycles,
    deadFunctions,
  } = useExplorer();

  const [treeFilter, setTreeFilter] = useState('');

  // Extract folder name from projectPath or projectMeta
  const projectName = useMemo(() => {
    if (projectMeta?.name) return projectMeta.name;
    if (!projectPath) return 'Project';
    const parts = projectPath.split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1] || 'Project';
  }, [projectPath, projectMeta]);

  // Group nodes by file
  const fileGroups = useMemo(() => {
    const map = new Map<string, typeof nodes>();
    nodes.forEach((n) => {
      const list = map.get(n.filename) || [];
      list.push(n);
      map.set(n.filename, list);
    });
    return Array.from(map.entries());
  }, [nodes]);

  const filteredGroups = useMemo(() => {
    if (!treeFilter.trim()) return fileGroups;
    const q = treeFilter.toLowerCase();
    return fileGroups
      .map(([filename, syms]) => {
        const matchesFile = filename.toLowerCase().includes(q);
        const matchedSyms = syms.filter((s) => s.name.toLowerCase().includes(q));
        if (matchesFile) return [filename, syms] as const;
        if (matchedSyms.length > 0) return [filename, matchedSyms] as const;
        return null;
      })
      .filter(Boolean) as [string, typeof nodes][];
  }, [fileGroups, treeFilter]);

  const totalClasses = nodes.filter((n) => n.kind === 'class').length;
  const totalFunctions = nodes.filter((n) => n.kind === 'function').length;

  const isUnfolded = leftPanelOpen || leftPanelHovered;

  // MINIMIZED STATE: Sleek floating dock pill on the left edge
  if (!isUnfolded) {
    return (
      <div
        onMouseEnter={() => setLeftPanelHovered(true)}
        onClick={() => setLeftPanelOpen(true)}
        className="absolute left-4 top-16 z-40 bg-[#121217]/90 hover:bg-[#181822] backdrop-blur-xl border border-white/10 hover:border-blue-500/50 rounded-2xl px-3 py-2 shadow-2xl cursor-pointer transition-all duration-200 flex items-center gap-2 group hover:scale-[1.02]"
        title="Hover to peek, click to pin open"
      >
        <span className="material-symbols-outlined text-blue-400 group-hover:text-blue-300" style={{ fontSize: 16 }}>
          account_tree
        </span>
        <span className="font-mono text-xs font-semibold text-zinc-200 tracking-tight">
          {projectName}
        </span>
        <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded-full">
          {nodes.length}
        </span>
      </div>
    );
  }

  // EXPANDED STATE: Floating Glass Sheet with hover auto-minimize & click-to-pin
  return (
    <aside
      style={{ width: `${sidebarWidth}px` }}
      onMouseEnter={() => setLeftPanelHovered(true)}
      onMouseLeave={() => setLeftPanelHovered(false)}
      className="absolute left-4 top-16 bottom-5 bg-[#0e0e13]/92 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-40 flex flex-col justify-between overflow-hidden select-none transition-all duration-300 animate-in fade-in"
      id="projectSidebar"
    >
      {/* Top Section */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Floating Panel Header */}
        <div className="h-11 px-3.5 border-b border-white/5 flex items-center justify-between bg-[#14141c]/50">
          <div className="flex items-center space-x-2 truncate">
            <span className="material-symbols-outlined text-blue-400" style={{ fontSize: 16 }}>
              account_tree
            </span>
            <span className="text-xs font-semibold text-zinc-100 tracking-tight truncate font-mono">
              {projectName}
            </span>
            {!leftPanelOpen && (
              <span className="text-[9px] font-mono text-zinc-400 bg-zinc-800/60 px-1.5 py-0.2 rounded-md">
                peek
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1">
            {/* Pin / Unpin button */}
            <button
              onClick={() => setLeftPanelOpen((prev) => !prev)}
              className={`p-1.5 rounded-lg transition-colors ${
                leftPanelOpen
                  ? 'text-blue-400 bg-blue-500/20 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
              }`}
              title={leftPanelOpen ? 'Pinned open (Click to unpin and auto-hide)' : 'Click to pin open'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
                {leftPanelOpen ? 'push_pin' : 'keep'}
              </span>
            </button>

            {/* Fold button */}
            <button
              onClick={() => {
                setLeftPanelOpen(false);
                setLeftPanelHovered(false);
              }}
              className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg transition-colors"
              title="Fold panel"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                close_fullscreen
              </span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-2 py-1.5 border-b border-white/5 gap-1 bg-[#101017]">
          {(['files', 'symbols', 'layers', 'metrics'] as SidebarTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setSidebarTab(tab)}
              className={`flex-1 py-1 rounded-lg text-[10px] font-medium capitalize transition-all ${
                sidebarTab === tab
                  ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Filter Input */}
        <div className="p-2.5 border-b border-white/5">
          <div className="relative flex items-center">
            <span
              className="material-symbols-outlined absolute left-2 text-zinc-500 pointer-events-none"
              style={{ fontSize: 14 }}
            >
              search
            </span>
            <input
              type="text"
              value={treeFilter}
              onChange={(e) => setTreeFilter(e.target.value)}
              placeholder="Filter architecture map..."
              className="w-full bg-[#161620] border border-white/5 rounded-lg px-2.5 py-1 pl-7 text-[11px] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 transition-all font-mono"
            />
            {treeFilter && (
              <button
                onClick={() => setTreeFilter('')}
                className="absolute right-2 text-zinc-500 hover:text-zinc-300"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                  close
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Tree Content */}
        <div className="flex-1 overflow-y-auto tree-scroll py-1.5 px-2 space-y-2">
          {sidebarTab === 'files' && (
            <div>
              {filteredGroups.length === 0 ? (
                <div className="p-4 text-center text-zinc-500 font-mono text-[11px]">
                  No matching files or symbols found.
                </div>
              ) : (
                filteredGroups.map(([filename, syms]) => {
                  const modMeta = modules?.find(
                    (m) => m.filename === filename || m.rel_path.endsWith(filename)
                  );
                  return (
                    <div key={filename} className="mb-2.5">
                      {/* File Header */}
                      <div className="flex flex-col px-2 py-1 text-zinc-400 rounded-lg hover:bg-zinc-800/40 cursor-default group">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 truncate">
                            <span
                              className="material-symbols-outlined text-amber-500/80"
                              style={{ fontSize: 14 }}
                            >
                              description
                            </span>
                            <span className="font-mono text-[11px] text-zinc-200 font-medium truncate">
                              {filename}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-zinc-500 group-hover:text-zinc-400">
                            {syms.length} syms
                          </span>
                        </div>

                        {/* Module Coupling Metrics */}
                        {modMeta?.coupling && (
                          <div className="flex items-center gap-2 mt-1 text-[9px] font-mono text-zinc-500">
                            <span title="Afferent coupling (incoming module deps)">
                              Ca: <span className="text-zinc-400">{modMeta.coupling.afferent_coupling_ca}</span>
                            </span>
                            <span>•</span>
                            <span title="Efferent coupling (outgoing module deps)">
                              Ce: <span className="text-zinc-400">{modMeta.coupling.efferent_coupling_ce}</span>
                            </span>
                            <span>•</span>
                            <span title="Instability metric I = Ce / (Ca + Ce)">
                              I: <span className="text-zinc-400">{modMeta.coupling.instability_metric}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Symbols under file */}
                      <div className="ml-3 pl-2 border-l border-zinc-800/80 mt-0.5 space-y-0.5">
                        {syms.map((sym) => {
                          const isSelected = selectedNode?.id === sym.id;
                          const isClass = sym.kind === 'class';
                          return (
                            <div
                              key={sym.id}
                              onClick={() => selectNode(sym)}
                              className={`flex items-center justify-between px-2 py-1 rounded-lg cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-blue-600/25 text-blue-200 border border-blue-500/40 font-semibold'
                                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                              }`}
                            >
                              <div className="flex items-center space-x-1.5 truncate">
                                <span
                                  className={`text-[9px] font-mono px-1 rounded uppercase tracking-wider ${
                                    isClass
                                      ? 'bg-amber-500/20 text-amber-400 font-semibold'
                                      : 'bg-zinc-800 text-zinc-400'
                                  }`}
                                >
                                  {isClass ? 'cls' : 'fn'}
                                </span>
                                <span className="font-mono text-[11px] truncate">{sym.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {sym.cyclomatic_complexity !== undefined && sym.cyclomatic_complexity !== null && (
                                  <span
                                    className={`text-[9px] font-mono px-1 rounded ${
                                      sym.complexity_rating === 'low'
                                        ? 'text-emerald-400'
                                        : sym.complexity_rating === 'moderate'
                                        ? 'text-amber-400'
                                        : 'text-rose-400'
                                    }`}
                                  >
                                    C{sym.cyclomatic_complexity}
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-zinc-600">
                                  L{sym.line}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {sidebarTab === 'symbols' && (
            <div className="space-y-0.5">
              {nodes
                .filter((n) => !treeFilter || n.name.toLowerCase().includes(treeFilter.toLowerCase()))
                .map((sym) => {
                  const isSelected = selectedNode?.id === sym.id;
                  const isClass = sym.kind === 'class';
                  return (
                    <div
                      key={sym.id}
                      onClick={() => selectNode(sym)}
                      className={`flex items-center justify-between px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-600/25 text-blue-200 border border-blue-500/40 font-semibold'
                          : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span
                          className={`text-[9px] font-mono px-1 rounded uppercase tracking-wider ${
                            isClass
                              ? 'bg-amber-500/20 text-amber-400 font-semibold'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {isClass ? 'cls' : 'fn'}
                        </span>
                        <span className="font-mono text-[11px] truncate">{sym.name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                        {sym.tier && (
                          <span className="text-[9px] text-zinc-400 bg-zinc-800 px-1 rounded">
                            {sym.tier}
                          </span>
                        )}
                        <span className="truncate max-w-[65px] text-zinc-600">{sym.filename}</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {sidebarTab === 'layers' && (
            <div className="p-1 space-y-2 font-mono text-[11px]">
              {layers && Object.keys(layers).length > 0 ? (
                Object.entries(layers).map(([tierName, nodeIds]) => (
                  <div key={tierName} className="p-2.5 bg-[#161622] border border-white/5 rounded-xl">
                    <div className="text-zinc-300 font-medium text-[11px] mb-1.5 flex items-center justify-between">
                      <span className="uppercase tracking-wider text-blue-400">{tierName}</span>
                      <span className="text-zinc-500 font-normal">{nodeIds.length} symbols</span>
                    </div>
                    <div className="space-y-1 max-h-28 overflow-y-auto tree-scroll">
                      {nodeIds.map((nid) => (
                        <div
                          key={nid}
                          onClick={() => selectNodeById(nid)}
                          className="text-[10px] text-zinc-400 hover:text-blue-300 hover:bg-zinc-800/50 px-1.5 py-0.5 rounded cursor-pointer truncate transition-colors"
                        >
                          • {nid}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-3 text-center text-zinc-500 text-[11px]">
                  No architectural layers discovered yet.
                </div>
              )}
            </div>
          )}

          {sidebarTab === 'metrics' && (
            <div className="p-1 space-y-3 font-mono text-[11px]">
              {/* Circular Dependencies */}
              <div className="p-2.5 bg-[#161622] border border-white/5 rounded-xl">
                <div className="text-zinc-300 font-medium text-[11px] mb-1 flex items-center justify-between">
                  <span>Circular Cycles</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                      activeCycles.length === 0
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-rose-400 bg-rose-500/10'
                    }`}
                  >
                    {activeCycles.length} detected
                  </span>
                </div>
                {activeCycles.length === 0 ? (
                  <div className="text-[10px] text-zinc-500 italic mt-1">
                    Clean DAG — no recursive cycles.
                  </div>
                ) : (
                  <div className="space-y-1 mt-1.5">
                    {activeCycles.map((cycle, idx) => (
                      <div
                        key={idx}
                        className="text-[10px] text-rose-300 bg-rose-950/30 p-1.5 rounded border border-rose-500/20 truncate"
                      >
                        {cycle.join(' ⇄ ')}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dead Functions */}
              <div className="p-2.5 bg-[#161622] border border-white/5 rounded-xl">
                <div className="text-zinc-300 font-medium text-[11px] mb-1 flex items-center justify-between">
                  <span>Dead Functions</span>
                  <span className="text-[10px] text-zinc-400">
                    {deadFunctions.length} unreferenced
                  </span>
                </div>
                {deadFunctions.length === 0 ? (
                  <div className="text-[10px] text-zinc-500 italic mt-1">
                    No dead code detected.
                  </div>
                ) : (
                  <div className="space-y-1 mt-1.5 max-h-32 overflow-y-auto tree-scroll">
                    {deadFunctions.map((df) => (
                      <div
                        key={df.id}
                        onClick={() => selectNodeById(df.id)}
                        className="text-[10px] text-amber-300 hover:text-amber-100 hover:bg-zinc-800/60 px-1.5 py-0.5 rounded cursor-pointer truncate transition-colors flex items-center justify-between"
                      >
                        <span className="truncate">{df.name}</span>
                        <span className="text-[9px] text-zinc-600">L{df.line}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Complexity Hotspots */}
              {diagnostics?.hotspots && diagnostics.hotspots.length > 0 && (
                <div className="p-2.5 bg-[#161622] border border-white/5 rounded-xl">
                  <div className="text-zinc-300 font-medium text-[11px] mb-1 flex items-center justify-between">
                    <span>Complexity Hotspots</span>
                    <span className="text-[10px] text-zinc-400">
                      Top {diagnostics.hotspots.length}
                    </span>
                  </div>
                  <div className="space-y-1 mt-1.5 max-h-32 overflow-y-auto tree-scroll">
                    {diagnostics.hotspots.map((hs) => (
                      <div
                        key={hs.id}
                        onClick={() => selectNodeById(hs.id)}
                        className="text-[10px] text-zinc-300 hover:text-white hover:bg-zinc-800/60 px-1.5 py-0.5 rounded cursor-pointer truncate transition-colors flex items-center justify-between"
                      >
                        <span className="truncate">{hs.name}</span>
                        <span
                          className={`text-[9px] px-1 rounded ${
                            hs.rating === 'critical'
                              ? 'text-rose-400 bg-rose-500/10'
                              : hs.rating === 'high'
                              ? 'text-orange-400 bg-orange-500/10'
                              : 'text-amber-400 bg-amber-500/10'
                          }`}
                        >
                          CC {hs.complexity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Summary Footer */}
      <div className="p-3 border-t border-white/5 bg-[#12121a]/80">
        <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
          <div className="bg-[#181822] px-2 py-1 rounded-lg border border-white/5 flex justify-between items-center">
            <span className="text-zinc-500">Functions</span>
            <span className="text-zinc-200 font-semibold">{totalFunctions}</span>
          </div>
          <div className="bg-[#181822] px-2 py-1 rounded-lg border border-white/5 flex justify-between items-center">
            <span className="text-zinc-500">Classes</span>
            <span className="text-zinc-200 font-semibold">{totalClasses}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
