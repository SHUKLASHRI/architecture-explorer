import React, { useState, useMemo } from 'react';
import { useExplorer } from '../context/ExplorerContext';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import {
  Terminal,
  Crosshair,
  Edit,
  Pin,
  X,
  FileCode,
  Copy,
  Check,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';

export const InspectorPanel: React.FC = () => {
  const {
    selectedNode,
    selectNodeById,
    sourceSnippet,
    isLoadingSource,
    sourceError,
    retrySourceSnippet,
    impact,
    openRenameModal,
    inspectorWidth,
    rightPanelOpen,
    setRightPanelOpen,
    rightPanelHovered,
    setRightPanelHovered,
    setIsEditorFocused,
    nodes,
    activeCycles,
  } = useExplorer();

  const [copied, setCopied] = useState(false);

  const isUnfolded = rightPanelOpen || rightPanelHovered;

  // Compute reality check metrics (Combats Confirmation Bias)
  const directCallers = (impact && impact.direct_callers) || [];
  const transitiveCallers = (impact && impact.callers) || directCallers;
  const hiddenCallersCount = Math.max(0, transitiveCallers.length - directCallers.length);
  const callees = (impact && impact.direct_callees) || [];

  // 1. Layer boundary violations (Combat Confirmation Bias: "My code is cleanly layered")
  const layerViolations = useMemo(() => {
    if (!selectedNode || !selectedNode.tier) return [];
    const srcTier = selectedNode.tier.toLowerCase();
    const violations: { callee: string; targetTier: string; reason: string }[] = [];

    callees.forEach((calleeId) => {
      const target = nodes.find((n) => n.id === calleeId || n.name === calleeId);
      if (target?.tier) {
        const tgtTier = target.tier.toLowerCase();
        if (srcTier === 'presentation' && tgtTier === 'persistence') {
          violations.push({
            callee: target.name,
            targetTier: tgtTier,
            reason: 'Presentation directly calls Persistence (bypasses Services)',
          });
        } else if (
          srcTier === 'persistence' &&
          (tgtTier === 'presentation' || tgtTier === 'services')
        ) {
          violations.push({
            callee: target.name,
            targetTier: tgtTier,
            reason: 'Persistence inversely calls higher-level tier',
          });
        }
      }
    });
    return violations;
  }, [selectedNode, callees, nodes]);

  // 2. Dead / Orphan detection (Combat Confirmation Bias: "All code is used")
  const isOrphan =
    selectedNode &&
    directCallers.length === 0 &&
    selectedNode.name !== 'main' &&
    !selectedNode.name.startsWith('test_') &&
    selectedNode.kind !== 'class';

  // 3. Circular Dependency (Combat Confirmation Bias: "No circular loops")
  const cycleInvolved = useMemo(() => {
    if (!selectedNode) return null;
    return activeCycles.find(
      (cycle) => cycle.includes(selectedNode.id) || cycle.includes(selectedNode.name)
    );
  }, [activeCycles, selectedNode]);

  // 4. Affected files across blast radius
  const blastRadiusFiles = useMemo(() => {
    const fileSet = new Set<string>();
    transitiveCallers.forEach((cId) => {
      const cNode = nodes.find((n) => n.id === cId || n.name === cId);
      if (cNode?.filename) fileSet.add(cNode.filename);
    });
    return Array.from(fileSet);
  }, [transitiveCallers, nodes]);

  // MINIMIZED STATE: Sleek VS Code docked tab pill on the right
  if (!isUnfolded) {
    return (
      <div
        onMouseEnter={() => setRightPanelHovered(true)}
        onClick={() => setRightPanelOpen(true)}
        className="absolute right-3 top-14 z-40 bg-[#252526] hover:bg-[#2a2d2e] border border-[#3e3e42] hover:border-[#007acc] rounded-[3px] px-2.5 py-1.5 shadow-lg cursor-pointer transition-colors flex items-center gap-2"
        title="Hover to peek, click to pin open (Ctrl+J)"
      >
        <Terminal size={14} className="text-[#007acc]" />
        <span className="font-mono text-xs font-medium text-[#cccccc] truncate max-w-[130px]">
          {selectedNode ? selectedNode.name : 'Inspector'}
        </span>
      </div>
    );
  }

  // EMPTY STATE (No symbol selected)
  if (!selectedNode) {
    return (
      <aside
        style={{ width: `${inspectorWidth}px` }}
        onMouseEnter={() => setRightPanelHovered(true)}
        onMouseLeave={() => setRightPanelHovered(false)}
        className="absolute right-3 top-14 bottom-6 bg-[#252526] border border-[#3e3e42] rounded-[3px] shadow-2xl z-40 flex flex-col items-center justify-center p-6 text-center select-none"
      >
        <Crosshair size={28} className="text-[#858585] mb-2" />
        <div className="text-[#ffffff] font-medium text-xs mb-1">Select a Symbol</div>
        <p className="text-[11px] text-[#858585] max-w-[210px] leading-relaxed">
          Click on any node in the architecture graph to inspect callers, callees, metrics, and source code.
        </p>
      </aside>
    );
  }

  const isClass = selectedNode.kind === 'class';
  const isMethod = Boolean(selectedNode.class_owner);
  const callers = directCallers;

  const handleCopySource = () => {
    if (!sourceSnippet?.lines) return;
    const text = sourceSnippet.lines
      .map((l: any) => (typeof l === 'string' ? l : l.content))
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const highlightPython = (code: string) => {
    try {
      const grammar = Prism.languages.python || Prism.languages.javascript || {};
      return Prism.highlight(code || ' ', grammar, 'python');
    } catch {
      return code || ' ';
    }
  };

  // EXPANDED STATE: VS Code Inspector Workbench Panel
  return (
    <aside
      style={{ width: `${inspectorWidth}px` }}
      onMouseEnter={() => setRightPanelHovered(true)}
      onMouseLeave={() => setRightPanelHovered(false)}
      className="absolute right-3 top-14 bottom-6 bg-[#252526] border border-[#3e3e42] rounded-[3px] shadow-2xl z-40 flex flex-col justify-between overflow-hidden select-none transition-all duration-200"
      id="inspectorPanel"
    >
      {/* Header Bar */}
      <div className="h-9 px-3 border-b border-[#3e3e42] flex items-center justify-between bg-[#2d2d2d]">
        <div className="flex items-center space-x-2 truncate">
          <span
            className={`text-[9px] font-mono px-1.5 py-0.2 rounded-[2px] font-semibold uppercase tracking-wider ${
              isClass
                ? 'bg-[#203330] text-[#4ec9b0] border border-[#2a4e48]'
                : 'bg-[#333220] text-[#dcdcaa] border border-[#4d4a2a]'
            }`}
          >
            {isClass ? 'Class' : isMethod ? 'Method' : 'Function'}
          </span>
          <span
            className={`font-mono text-xs font-semibold truncate ${
              isClass ? 'text-[#4ec9b0]' : 'text-[#dcdcaa]'
            }`}
          >
            {selectedNode.name}
          </span>
        </div>

        <div className="flex items-center space-x-1">
          {/* Refactor shortcut button */}
          <button
            onClick={() => openRenameModal(selectedNode)}
            className="px-1.5 py-0.5 bg-[#333333] hover:bg-[#3e3e42] border border-[#3e3e42] rounded-[2px] text-[10px] font-mono text-[#cccccc] hover:text-[#ffffff] flex items-center gap-1 transition-colors"
            title="Safe Refactor / Rename (F2)"
          >
            <Edit size={11} />
            <span>F2</span>
          </button>

          {/* Pin / Unpin button */}
          <button
            onClick={() => setRightPanelOpen((prev) => !prev)}
            className={`p-1 rounded-[2px] transition-colors flex items-center justify-center ${
              rightPanelOpen
                ? 'text-[#ffffff] bg-[#094771] border border-[#007acc]'
                : 'text-[#858585] hover:text-[#ffffff] hover:bg-[#383838]'
            }`}
            title={rightPanelOpen ? 'Pinned open (Click to unpin and auto-hide)' : 'Click to pin open'}
          >
            <Pin size={13} />
          </button>

          {/* Fold button */}
          <button
            onClick={() => {
              setRightPanelOpen(false);
              setRightPanelHovered(false);
            }}
            className="p-1 text-[#858585] hover:text-[#ffffff] hover:bg-[#383838] rounded-[2px] transition-colors flex items-center justify-center"
            title="Fold Inspector (Escape)"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto code-scroll p-3 space-y-3">
        {/* Symbol Declaration Card */}
        <div className="p-2.5 bg-[#1e1e1e] border border-[#3e3e42] rounded-[2px] space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {selectedNode.tier && (
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-[2px] bg-[#252526] text-[#858585] border border-[#3e3e42] uppercase tracking-wider font-semibold">
                  {selectedNode.tier}
                </span>
              )}
              {selectedNode.cyclomatic_complexity !== undefined && selectedNode.cyclomatic_complexity !== null && (
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.2 rounded-[2px] font-semibold border ${
                    selectedNode.complexity_rating === 'low'
                      ? 'bg-[#203330] text-[#4ec9b0] border-[#2a4e48]'
                      : selectedNode.complexity_rating === 'moderate'
                      ? 'bg-[#333020] text-[#cca700] border-[#4d4a2a]'
                      : 'bg-[#332020] text-[#f14c4c] border-[#4a2a2a]'
                  }`}
                  title={`McCabe Cyclomatic Complexity: ${selectedNode.cyclomatic_complexity} (${selectedNode.complexity_rating || 'evaluated'})`}
                >
                  CC: {selectedNode.cyclomatic_complexity} {selectedNode.complexity_rating}
                </span>
              )}
            </div>

            <span className="text-[10px] font-mono text-[#858585]">
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
                  className="text-[10px] font-mono text-[#c586c0] bg-[#2d222d] border border-[#4a2a4a] px-1.5 py-0.2 rounded-[2px]"
                >
                  {dec}
                </span>
              ))}
            </div>
          )}

          {/* Full Signature */}
          <div className="font-mono text-xs text-[#cccccc] bg-[#181818] p-2 rounded-[2px] border border-[#2d2d2d] overflow-x-auto leading-relaxed">
            {selectedNode.signature ? (
              <span>{selectedNode.signature}</span>
            ) : (
              <>
                <span className="text-[#569cd6]">
                  {selectedNode.is_async ? 'async def ' : isClass ? 'class ' : 'def '}
                </span>
                <span className={`font-semibold ${isClass ? 'text-[#4ec9b0]' : 'text-[#dcdcaa]'}`}>
                  {selectedNode.name}
                </span>
                <span className="text-[#cccccc]">
                  ({Array.isArray(selectedNode.args) ? selectedNode.args.join(', ') : ''})
                </span>
                {selectedNode.return_type && (
                  <span className="text-[#4ec9b0]"> -&gt; {selectedNode.return_type}</span>
                )}
              </>
            )}
          </div>

          {/* Docstring */}
          {selectedNode.docstring && (
            <div className="p-2 bg-[#181818] border border-[#2d2d2d] rounded-[2px] text-[11px] font-mono text-[#6a9955]">
              <div className="text-[9px] text-[#858585] font-sans uppercase tracking-wider mb-1 font-semibold">
                Docstring
              </div>
              <p className="italic leading-relaxed whitespace-pre-wrap">{selectedNode.docstring}</p>
            </div>
          )}

          {/* Parameters Detail */}
          {selectedNode.parameters && selectedNode.parameters.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="text-[9px] font-mono text-[#858585] uppercase tracking-wider font-semibold">
                Parameters ({selectedNode.parameters.length})
              </div>
              <div className="space-y-1 max-h-28 overflow-y-auto tree-scroll">
                {selectedNode.parameters.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-[11px] font-mono bg-[#181818] px-2 py-0.5 rounded-[2px] border border-[#2d2d2d]"
                  >
                    <span className="text-[#9cdcfe] font-medium">{p.name}</span>
                    <div className="flex items-center gap-1.5">
                      {p.type && <span className="text-[#4ec9b0] text-[10px]">{p.type}</span>}
                      {p.default && (
                        <span className="text-[#858585] text-[10px]">= {p.default}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* File location */}
          <div className="text-[10px] font-mono text-[#858585] flex items-center gap-1.5 truncate pt-1 border-t border-[#2d2d2d]">
            <FileCode size={13} className="text-[#858585] flex-shrink-0" />
            <span className="truncate">{selectedNode.rel_path || selectedNode.file}</span>
          </div>
        </div>

        {/* REALITY CHECK (Combats Confirmation Bias) */}
        <div className="p-2.5 bg-[#1e1e1e] border border-[#3e3e42] rounded-[2px] space-y-2">
          <div className="flex items-center justify-between text-[11px] font-mono font-semibold text-[#cccccc]">
            <div className="flex items-center gap-1.5">
              <ShieldAlert
                size={14}
                className={
                  layerViolations.length > 0 || isOrphan || cycleInvolved
                    ? 'text-[#cca700]'
                    : 'text-[#4ec9b0]'
                }
              />
              <span>Reality Check</span>
            </div>
            <span className="text-[9px] text-[#858585] uppercase tracking-wider">
              Objective Telemetry
            </span>
          </div>

          <div className="space-y-1.5 text-[10px] font-mono">
            {/* Transitive Blast Radius (Countering "It only affects this file") */}
            <div className="p-1.5 rounded-[2px] bg-[#181818] border border-[#2d2d2d] flex items-center justify-between">
              <span className="text-[#858585]">Blast Radius:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[#cccccc] font-medium">{directCallers.length} direct</span>
                {hiddenCallersCount > 0 ? (
                  <span
                    className="text-[#cca700] bg-[#332a15] px-1 rounded-[1px] border border-[#4d4020]"
                    title={`${hiddenCallersCount} indirect downstream callers affected across ${blastRadiusFiles.length} file(s)`}
                  >
                    +{hiddenCallersCount} hidden indirect ({blastRadiusFiles.length} file{blastRadiusFiles.length !== 1 ? 's' : ''})
                  </span>
                ) : (
                  <span className="text-[#4ec9b0]">Isolated</span>
                )}
              </div>
            </div>

            {/* Layer Inversion / Boundary Check (Countering "Code is cleanly layered") */}
            {layerViolations.length > 0 ? (
              <div className="p-1.5 rounded-[2px] bg-[#332a15] border border-[#cca700]/50 text-[#e0d6b5] space-y-0.5">
                <div className="flex items-center gap-1 text-[#cca700] font-semibold">
                  <AlertTriangle size={12} />
                  <span>Layer Boundary Leak</span>
                </div>
                {layerViolations.map((v, i) => (
                  <div key={i} className="text-[10px] text-[#cccccc]">
                    • {v.reason} (<span className="text-[#dcdcaa]">{v.callee}</span>)
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-1.5 rounded-[2px] bg-[#181818] border border-[#2d2d2d] flex items-center justify-between text-[#858585]">
                <span>Layer Integrity:</span>
                <span className="text-[#4ec9b0]">Clean Layering</span>
              </div>
            )}

            {/* Circular Dependency Loop */}
            {cycleInvolved && (
              <div className="p-1.5 rounded-[2px] bg-[#332020] border border-[#f14c4c]/40 text-[#f14c4c] flex items-center gap-1.5">
                <RotateCcw size={12} className="flex-shrink-0" />
                <span className="truncate">Circular Chain: {cycleInvolved.join(' ⇄ ')}</span>
              </div>
            )}

            {/* Orphan Code Alert (Countering "Everything here is used") */}
            {isOrphan && (
              <div className="p-1.5 rounded-[2px] bg-[#2d2815] border border-[#cca700]/40 text-[#cca700] flex items-center gap-1.5">
                <AlertCircle size={12} className="flex-shrink-0" />
                <span>0 Callers in Project (Potential Dead Code)</span>
              </div>
            )}
          </div>
        </div>

        {/* Call Graph Connections */}
        <div className="grid grid-cols-2 gap-2">
          {/* Callers */}
          <div className="p-2 bg-[#1e1e1e] border border-[#3e3e42] rounded-[2px]">
            <div className="text-[10px] font-mono text-[#858585] font-semibold mb-1 flex items-center justify-between">
              <span>Callers ({callers.length})</span>
              <ArrowDownLeft size={13} className="text-[#858585]" />
            </div>
            {callers.length === 0 ? (
              <div className="text-[10px] font-mono text-[#6e7681] italic">No incoming calls</div>
            ) : (
              <div className="space-y-0.5 max-h-24 overflow-y-auto tree-scroll">
                {callers.map((c) => (
                  <div
                    key={c}
                    onClick={() => selectNodeById(c)}
                    className="text-[10px] font-mono text-[#cccccc] hover:text-[#ffffff] hover:bg-[#2a2d2e] px-1.5 py-0.5 rounded-[2px] cursor-pointer truncate transition-colors"
                  >
                    ← {c}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Callees */}
          <div className="p-2 bg-[#1e1e1e] border border-[#3e3e42] rounded-[2px]">
            <div className="text-[10px] font-mono text-[#858585] font-semibold mb-1 flex items-center justify-between">
              <span>Calls ({callees.length})</span>
              <ArrowUpRight size={13} className="text-[#858585]" />
            </div>
            {callees.length === 0 ? (
              <div className="text-[10px] font-mono text-[#6e7681] italic">No outgoing calls</div>
            ) : (
              <div className="space-y-0.5 max-h-24 overflow-y-auto tree-scroll">
                {callees.map((c) => (
                  <div
                    key={c}
                    onClick={() => selectNodeById(c)}
                    className="text-[10px] font-mono text-[#cccccc] hover:text-[#ffffff] hover:bg-[#2a2d2e] px-1.5 py-0.5 rounded-[2px] cursor-pointer truncate transition-colors"
                  >
                    → {c}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Source Code Viewer (VS Code Editor View) */}
        <div
          className="border border-[#3e3e42] rounded-[2px] overflow-hidden bg-[#1e1e1e]"
          onMouseEnter={() => setIsEditorFocused(true)}
          onMouseLeave={() => setIsEditorFocused(false)}
        >
          {/* Editor Header Tab */}
          <div className="h-7 px-2.5 bg-[#2d2d2d] border-b border-[#3e3e42] flex items-center justify-between">
            <div className="flex items-center space-x-1.5 truncate">
              <FileCode size={13} className="text-[#007acc] flex-shrink-0" />
              <span className="text-[11px] font-mono text-[#cccccc] font-medium truncate">
                {selectedNode.filename}
              </span>
            </div>

            <button
              onClick={handleCopySource}
              className="px-1.5 py-0.2 rounded-[2px] text-[10px] font-mono text-[#858585] hover:text-[#cccccc] hover:bg-[#383838] transition-colors flex items-center gap-1"
              title="Copy snippet"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {/* Editor Code Area */}
          <div className="bg-[#1e1e1e] p-2 max-h-72 overflow-auto code-scroll text-[11px] font-mono">
            {isLoadingSource ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-[#858585] font-mono text-xs">
                <div className="w-4 h-4 border-2 border-[#007acc] border-t-transparent rounded-full animate-spin" />
                <span>Loading source snippet...</span>
              </div>
            ) : sourceError ? (
              <div className="py-4 px-3 bg-[#2b2020] border border-[#f14c4c]/40 rounded-[2px] text-center space-y-2">
                <div className="text-[11px] text-[#f14c4c] font-semibold flex items-center justify-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>Source preview unavailable</span>
                </div>
                <p className="text-[10px] text-[#858585]">{sourceError}</p>
                <button
                  onClick={retrySourceSnippet}
                  className="px-2.5 py-1 bg-[#333333] hover:bg-[#3e3e42] text-[#cccccc] hover:text-[#ffffff] rounded-[2px] text-[10px] font-mono transition-colors"
                >
                  Retry Loading
                </button>
              </div>
            ) : sourceSnippet?.lines && sourceSnippet.lines.length > 0 ? (
              <div className="space-y-0 min-w-full">
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
                      className={`flex items-start group rounded-[1px] px-1 transition-colors leading-relaxed ${
                        isTarget
                          ? 'bg-[#094771]/60 border-l-2 border-[#007acc] text-[#ffffff]'
                          : 'hover:bg-[#2a2d2e] text-[#cccccc]'
                      }`}
                    >
                      <span className="w-8 flex-shrink-0 text-right pr-3 text-[10px] text-[#858585] select-none group-hover:text-[#cccccc]">
                        {lineNum}
                      </span>
                      <pre className="flex-1 whitespace-pre leading-relaxed m-0 p-0 overflow-x-visible">
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
              <div className="py-6 text-center text-[#858585] font-mono text-xs">
                Source definition not available for this node.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="h-8 px-3 border-t border-[#3e3e42] bg-[#2d2d2d] flex items-center justify-between text-[10px] font-mono text-[#858585]">
        <span className="truncate max-w-[200px]">Node: {selectedNode.id}</span>
        <button
          onClick={() => openRenameModal(selectedNode)}
          className="text-[#007acc] hover:text-[#0098ff] font-medium hover:underline"
        >
          Refactor Symbol →
        </button>
      </div>
    </aside>
  );
};
