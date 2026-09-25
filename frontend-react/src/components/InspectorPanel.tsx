import React, { useState } from 'react';
import { useExplorer } from '../context/ExplorerContext';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';

export const InspectorPanel: React.FC = () => {
  const {
    selectedNode,
    selectNodeById,
    sourceSnippet,
    isLoadingSource,
    impact,
    openRenameModal,
    inspectorWidth,
    rightPanelOpen,
    setRightPanelOpen,
    rightPanelHovered,
    setRightPanelHovered,
    setIsEditorFocused,
  } = useExplorer();

  const [copied, setCopied] = useState(false);

  const isUnfolded = rightPanelOpen || rightPanelHovered;

  // MINIMIZED STATE: Sleek floating dock pill on the right edge
  if (!isUnfolded) {
    return (
      <div
        onMouseEnter={() => setRightPanelHovered(true)}
        onClick={() => setRightPanelOpen(true)}
        className="absolute right-4 top-16 z-40 bg-[#121217]/90 hover:bg-[#181822] backdrop-blur-xl border border-white/10 hover:border-blue-500/50 rounded-2xl px-3 py-2 shadow-2xl cursor-pointer transition-all duration-200 flex items-center gap-2 group hover:scale-[1.02]"
        title="Hover to peek, click to pin open"
      >
        <span className="material-symbols-outlined text-blue-400 group-hover:text-blue-300" style={{ fontSize: 16 }}>
          terminal
        </span>
        <span className="font-mono text-xs font-semibold text-zinc-200 tracking-tight truncate max-w-[140px]">
          {selectedNode ? selectedNode.name : 'Inspector'}
        </span>
        {selectedNode && (
          <span className="text-[10px] font-mono text-zinc-500 bg-zinc-800/80 px-1.5 py-0.5 rounded-full">
            L{selectedNode.line}
          </span>
        )}
      </div>
    );
  }

  // If no node selected
  if (!selectedNode) {
    return (
      <aside
        style={{ width: `${inspectorWidth}px` }}
        onMouseEnter={() => setRightPanelHovered(true)}
        onMouseLeave={() => setRightPanelHovered(false)}
        className="absolute right-4 top-16 bottom-5 bg-[#0e0e13]/92 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-40 flex flex-col items-center justify-center p-6 text-zinc-500 font-mono text-center select-none transition-all duration-300 animate-in fade-in"
      >
        <div className="absolute top-3 right-3 flex items-center space-x-1">
          <button
            onClick={() => setRightPanelOpen((prev) => !prev)}
            className={`p-1.5 rounded-lg transition-colors ${
              rightPanelOpen ? 'text-blue-400 bg-blue-500/20' : 'text-zinc-400 hover:text-zinc-100'
            }`}
            title={rightPanelOpen ? 'Pinned (Click to unpin)' : 'Click to pin'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              {rightPanelOpen ? 'push_pin' : 'keep'}
            </span>
          </button>
          <button
            onClick={() => {
              setRightPanelOpen(false);
              setRightPanelHovered(false);
            }}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg transition-colors"
            title="Fold panel"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              close_fullscreen
            </span>
          </button>
        </div>
        <span className="material-symbols-outlined text-zinc-600 text-3xl mb-2">
          ads_click
        </span>
        <div className="text-zinc-300 font-medium text-xs mb-1">Select a Symbol</div>
        <p className="text-[11px] text-zinc-500 max-w-[200px] leading-relaxed">
          Click on any node in the architecture graph to inspect callers, callees, and source code.
        </p>
      </aside>
    );
  }

  const isClass = selectedNode.kind === 'class';
  const isMethod = Boolean(selectedNode.class_owner);
  const callers = (impact && impact.direct_callers) || [];
  const callees = (impact && impact.direct_callees) || [];

  const handleCopySource = () => {
    if (!sourceSnippet?.lines) return;
    const text = sourceSnippet.lines
      .map((l: any) => (typeof l === 'string' ? l : l.content))
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const highlightPython = (code: string) => {
    try {
      return Prism.highlight(code || ' ', Prism.languages.python || {}, 'python');
    } catch {
      return code || ' ';
    }
  };

  // EXPANDED STATE: Floating Glass Sheet with hover-peek and click-pin
  return (
    <aside
      style={{ width: `${inspectorWidth}px` }}
      onMouseEnter={() => setRightPanelHovered(true)}
      onMouseLeave={() => setRightPanelHovered(false)}
      className="absolute right-4 top-16 bottom-5 bg-[#0e0e13]/92 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl z-40 flex flex-col justify-between overflow-hidden select-none transition-all duration-300 animate-in fade-in"
      id="inspectorPanel"
    >
      {/* Header Bar */}
      <div className="h-11 px-3.5 border-b border-white/5 flex items-center justify-between bg-[#14141c]/50">
        <div className="flex items-center space-x-2 truncate">
          <span
            className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md font-semibold uppercase tracking-wider ${
              isClass
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}
          >
            {isClass ? 'Class' : isMethod ? 'Method' : 'Function'}
          </span>
          <span className="font-mono text-xs font-semibold text-zinc-100 truncate">
            {selectedNode.name}
          </span>
          {!rightPanelOpen && (
            <span className="text-[9px] font-mono text-zinc-400 bg-zinc-800/60 px-1.5 py-0.2 rounded-md">
              peek
            </span>
          )}
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => openRenameModal(selectedNode)}
            className="px-2 py-1 bg-zinc-800/80 hover:bg-zinc-700/80 border border-white/10 rounded-lg text-[10px] font-mono text-zinc-300 hover:text-white flex items-center gap-1 transition-colors"
            title="Safe Refactor / Rename (F2)"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
              edit
            </span>
            <span>F2</span>
          </button>

          {/* Pin / Unpin button */}
          <button
            onClick={() => setRightPanelOpen((prev) => !prev)}
            className={`p-1.5 rounded-lg transition-colors ${
              rightPanelOpen
                ? 'text-blue-400 bg-blue-500/20 border border-blue-500/30'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60'
            }`}
            title={rightPanelOpen ? 'Pinned open (Click to unpin and auto-hide)' : 'Click to pin open'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              {rightPanelOpen ? 'push_pin' : 'keep'}
            </span>
          </button>

          {/* Fold button */}
          <button
            onClick={() => {
              setRightPanelOpen(false);
              setRightPanelHovered(false);
            }}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg transition-colors"
            title="Fold Inspector"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              close_fullscreen
            </span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto code-scroll p-3.5 space-y-3.5">
        {/* Symbol Declaration Card */}
        <div className="p-3 bg-[#151520] border border-white/5 rounded-xl space-y-2.5">
          <div className="flex items-center justify-between flex-wrap gap-1.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedNode.tier && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-white/5 uppercase tracking-wider font-semibold">
                  {selectedNode.tier}
                </span>
              )}
              {selectedNode.cyclomatic_complexity !== undefined && selectedNode.cyclomatic_complexity !== null && (
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md font-semibold border ${
                    selectedNode.complexity_rating === 'low'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : selectedNode.complexity_rating === 'moderate'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      : selectedNode.complexity_rating === 'high'
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                  }`}
                  title={`McCabe Cyclomatic Complexity: ${selectedNode.cyclomatic_complexity} (${selectedNode.complexity_rating || 'evaluated'})`}
                >
                  CC: {selectedNode.cyclomatic_complexity} {selectedNode.complexity_rating}
                </span>
              )}
            </div>

            <span className="text-[10px] font-mono text-zinc-400">
              L{selectedNode.line}{selectedNode.end_line ? `–L${selectedNode.end_line}` : ''}
              {selectedNode.loc ? ` (${selectedNode.loc} lines)` : ''}
            </span>
          </div>

          {/* Decorators */}
          {selectedNode.decorators && selectedNode.decorators.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selectedNode.decorators.map((dec, idx) => (
                <span
                  key={idx}
                  className="text-[10px] font-mono text-purple-300 bg-purple-950/40 border border-purple-500/30 px-1.5 py-0.5 rounded"
                >
                  {dec}
                </span>
              ))}
            </div>
          )}

          {/* Full Signature */}
          <div className="font-mono text-xs text-zinc-200 bg-[#0c0c10] p-2.5 rounded-lg border border-white/5 overflow-x-auto leading-relaxed">
            {selectedNode.signature ? (
              <span className="text-zinc-200">{selectedNode.signature}</span>
            ) : (
              <>
                <span className="text-blue-400">
                  {selectedNode.is_async ? 'async def ' : isClass ? 'class ' : 'def '}
                </span>
                <span className="font-bold text-white">{selectedNode.name}</span>
                <span className="text-zinc-400">
                  ({Array.isArray(selectedNode.args) ? selectedNode.args.join(', ') : ''})
                </span>
                {selectedNode.return_type && (
                  <span className="text-emerald-400"> -&gt; {selectedNode.return_type}</span>
                )}
              </>
            )}
          </div>

          {/* Docstring */}
          {selectedNode.docstring && (
            <div className="p-2.5 bg-[#0a0a0f] border border-white/5 rounded-lg text-[11px] font-mono text-zinc-300">
              <div className="text-[9px] text-zinc-500 font-sans uppercase tracking-wider mb-1 font-semibold">
                Docstring
              </div>
              <p className="italic leading-relaxed whitespace-pre-wrap">{selectedNode.docstring}</p>
            </div>
          )}

          {/* Parameters Detail */}
          {selectedNode.parameters && selectedNode.parameters.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">
                Parameters ({selectedNode.parameters.length})
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto tree-scroll">
                {selectedNode.parameters.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[11px] font-mono bg-[#0c0c10] px-2 py-1 rounded border border-white/5"
                  >
                    <span className="text-zinc-200 font-medium">{p.name}</span>
                    <div className="flex items-center gap-1.5">
                      {p.type && <span className="text-blue-400 text-[10px]">{p.type}</span>}
                      {p.default && (
                        <span className="text-zinc-500 text-[10px]">= {p.default}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Class Bases / Methods */}
          {isClass && selectedNode.bases && selectedNode.bases.length > 0 && (
            <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
              <span className="text-zinc-500">Bases:</span>
              <span className="text-amber-300">{selectedNode.bases.join(', ')}</span>
            </div>
          )}

          {isClass && selectedNode.methods && selectedNode.methods.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider font-semibold">
                Class Methods ({selectedNode.methods.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedNode.methods.map((m, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] font-mono text-zinc-300 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-white/5"
                  >
                    .{m}()
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5 truncate pt-0.5">
            <span className="material-symbols-outlined text-zinc-500" style={{ fontSize: 13 }}>
              source
            </span>
            <span className="truncate">{selectedNode.rel_path || selectedNode.file}</span>
          </div>
        </div>

        {/* Call Graph Connections */}
        <div className="grid grid-cols-2 gap-2">
          {/* Callers */}
          <div className="p-2.5 bg-[#151520] border border-white/5 rounded-xl">
            <div className="text-[10px] font-mono text-zinc-400 font-semibold mb-1.5 flex items-center justify-between">
              <span>Callers ({callers.length})</span>
              <span className="material-symbols-outlined text-zinc-500" style={{ fontSize: 13 }}>
                call_received
              </span>
            </div>
            {callers.length === 0 ? (
              <div className="text-[10px] font-mono text-zinc-600 italic">No incoming calls</div>
            ) : (
              <div className="space-y-1 max-h-24 overflow-y-auto tree-scroll">
                {callers.map((c) => (
                  <div
                    key={c}
                    onClick={() => selectNodeById(c)}
                    className="text-[10px] font-mono text-zinc-300 hover:text-blue-400 hover:bg-zinc-800/60 px-1.5 py-0.5 rounded cursor-pointer truncate transition-colors"
                  >
                    ← {c}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Callees */}
          <div className="p-2.5 bg-[#151520] border border-white/5 rounded-xl">
            <div className="text-[10px] font-mono text-zinc-400 font-semibold mb-1.5 flex items-center justify-between">
              <span>Calls ({callees.length})</span>
              <span className="material-symbols-outlined text-zinc-500" style={{ fontSize: 13 }}>
                call_made
              </span>
            </div>
            {callees.length === 0 ? (
              <div className="text-[10px] font-mono text-zinc-600 italic">No outgoing calls</div>
            ) : (
              <div className="space-y-1 max-h-24 overflow-y-auto tree-scroll">
                {callees.map((c) => (
                  <div
                    key={c}
                    onClick={() => selectNodeById(c)}
                    className="text-[10px] font-mono text-zinc-300 hover:text-blue-400 hover:bg-zinc-800/60 px-1.5 py-0.5 rounded cursor-pointer truncate transition-colors"
                  >
                    → {c}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Source Code Viewer (Interactive Editor View) */}
        <div
          className="border border-white/10 rounded-xl overflow-hidden shadow-inner"
          onMouseEnter={() => setIsEditorFocused(true)}
          onMouseLeave={() => setIsEditorFocused(false)}
        >
          {/* Editor Header */}
          <div className="h-8 px-3 bg-[#181822] border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span className="material-symbols-outlined text-blue-400" style={{ fontSize: 14 }}>
                terminal
              </span>
              <span className="text-[11px] font-mono text-zinc-300 font-medium">
                {selectedNode.filename}
              </span>
            </div>

            <button
              onClick={handleCopySource}
              className="px-2 py-0.5 rounded text-[10px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center gap-1"
              title="Copy snippet"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                {copied ? 'check' : 'content_copy'}
              </span>
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Editor Code Area */}
          <div className="bg-[#09090d] p-2 max-h-72 overflow-auto code-scroll text-[11px] font-mono">
            {isLoadingSource ? (
              <div className="py-6 text-center text-zinc-500 font-mono text-xs">
                Loading source snippet...
              </div>
            ) : sourceSnippet?.lines && sourceSnippet.lines.length > 0 ? (
              <div className="space-y-0.5 min-w-full">
                {sourceSnippet.lines.map((lineItem: any, idx: number) => {
                  const lineContent =
                    typeof lineItem === 'string' ? lineItem : lineItem?.content ?? '';
                  const lineNum =
                    typeof lineItem === 'object' && lineItem !== null
                      ? lineItem.number ?? idx + 1
                      : idx + 1;
                  const isTarget =
                    typeof lineItem === 'object' && lineItem !== null
                      ? Boolean(lineItem.is_target)
                      : false;

                  return (
                    <div
                      key={idx}
                      className={`flex items-start group rounded px-1 transition-colors ${
                        isTarget
                          ? 'bg-blue-500/15 border-l-2 border-blue-400 text-blue-200'
                          : 'hover:bg-zinc-800/30 text-zinc-300'
                      }`}
                    >
                      <span className="w-8 flex-shrink-0 text-right pr-3 text-[10px] text-zinc-600 select-none group-hover:text-zinc-500">
                        {lineNum}
                      </span>
                      <pre className="flex-1 whitespace-pre leading-snug">
                        <code
                          dangerouslySetInnerHTML={{
                            __html: highlightPython(lineContent),
                          }}
                        />
                      </pre>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-zinc-500 font-mono text-xs">
                Source definition not available for this node.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-white/5 bg-[#12121a]/80 flex items-center justify-between text-[10px] font-mono text-zinc-400">
        <span className="truncate">Node: {selectedNode.id}</span>
        <button
          onClick={() => openRenameModal(selectedNode)}
          className="text-blue-400 hover:text-blue-300 font-medium hover:underline"
        >
          Refactor Symbol →
        </button>
      </div>
    </aside>
  );
};
