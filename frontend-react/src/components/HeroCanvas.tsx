import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useExplorer } from '../context/ExplorerContext';
import type { GraphNode, AnalysisMode } from '../types';

export const HeroCanvas: React.FC = () => {
  const {
    nodes,
    edges,
    selectedNode,
    selectNode,
    analysisMode,
    setAnalysisMode,
    zoom,
    adjustZoom,
    resetZoom,
    panActive,
    togglePan,
    depthHops,
    setDepthHops,
    activeCycles,
    deadFunctions,
    focusMode,
    toggleFocusMode,
    isEditorFocused,
    nodeCustomPositions,
    updateNodePosition,
    resetNodePositions,
    minimizeAllPanels,
    isLoading,
    error,
    loadProject,
    projectPath,
  } = useExplorer();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 1200, height: 800 });
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Pan dragging state
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const hasMovedPan = useRef(false);
  const clickStartPos = useRef({ x: 0, y: 0 });
  const [isCurrentlyPanning, setIsCurrentlyPanning] = useState(false);

  // Node dragging state
  const draggedNode = useRef<{
    id: string;
    startMouseX: number;
    startMouseY: number;
    startNodeX: number;
    startNodeY: number;
  } | null>(null);

  const [activeDraggingId, setActiveDraggingId] = useState<string | null>(null);

  // ResizeObserver for dynamic adaptive sizing
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute adaptive base positions across 4 semantic tiers
  const baseNodePositions = useMemo(() => {
    const posMap = new Map<string, { x: number; y: number }>();
    if (nodes.length === 0) return posMap;

    const tier0: GraphNode[] = [];
    const tier1: GraphNode[] = [];
    const tier2: GraphNode[] = [];
    const tier3: GraphNode[] = [];

    nodes.forEach((n) => {
      const filename = (n.filename || '').toLowerCase();
      const name = (n.name || '').toLowerCase();

      if (name === 'main' || filename.includes('main') || name.includes('entry')) {
        tier0.push(n);
      } else if (filename.includes('auth') || name.includes('login') || name.includes('route')) {
        tier1.push(n);
      } else if (filename.includes('db') || filename.includes('model') || n.kind === 'class') {
        tier3.push(n);
      } else {
        tier2.push(n);
      }
    });

    const tiers = [tier0, tier1, tier2, tier3].filter((t) => t.length > 0);
    if (tiers.length === 0) return posMap;

    const colCount = tiers.length;
    const xMargin = 80;
    const yMargin = 90;
    const availableWidth = Math.max(containerSize.width - 2 * xMargin, 600);
    const colSpacing = colCount > 1 ? availableWidth / (colCount - 1) : 320;

    tiers.forEach((tierGroup, colIdx) => {
      const x = xMargin + colIdx * Math.min(colSpacing, 340);
      const rowSpacing = 110;
      tierGroup.forEach((node, rowIdx) => {
        const y = yMargin + rowIdx * rowSpacing;
        posMap.set(node.id, { x, y });
      });
    });

    return posMap;
  }, [nodes, containerSize]);

  // Merge base positions with user-dragged custom positions
  const effectivePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    nodes.forEach((n) => {
      if (nodeCustomPositions[n.id]) {
        map.set(n.id, nodeCustomPositions[n.id]);
      } else if (baseNodePositions.has(n.id)) {
        map.set(n.id, baseNodePositions.get(n.id)!);
      } else {
        map.set(n.id, { x: 120, y: 120 });
      }
    });
    return map;
  }, [nodes, baseNodePositions, nodeCustomPositions]);

  // Center & Fit View calculation
  const handleFitView = useCallback(() => {
    if (nodes.length === 0) return;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    effectivePositions.forEach((pos) => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + 220);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y + 100);
    });

    if (minX === Infinity) return;

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;
    const scaleX = (containerSize.width - 160) / Math.max(graphWidth, 100);
    const scaleY = (containerSize.height - 160) / Math.max(graphHeight, 100);
    const fitScale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.5), 1.2);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setPanOffset({
      x: containerSize.width / 2 - centerX * fitScale,
      y: containerSize.height / 2 - centerY * fitScale,
    });
  }, [nodes, effectivePositions, containerSize]);

  // Auto-center on initial nodes load
  useEffect(() => {
    if (nodes.length > 0) {
      handleFitView();
    }
  }, [nodes.length]);

  // Active callers & callees for highlighting
  const activeNodeIds = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const set = new Set<string>([selectedNode.id]);

    let frontier = [selectedNode.id];
    for (let hop = 0; hop < depthHops; hop++) {
      const nextFrontier: string[] = [];
      edges.forEach((e) => {
        if (frontier.includes(e.source) && !set.has(e.target)) {
          set.add(e.target);
          nextFrontier.push(e.target);
        }
        if (frontier.includes(e.target) && !set.has(e.source)) {
          set.add(e.source);
          nextFrontier.push(e.source);
        }
      });
      frontier = nextFrontier;
    }
    return set;
  }, [selectedNode, edges, depthHops]);

  // Dead node ids
  const deadNodeIds = useMemo(() => {
    return new Set(deadFunctions.map((df) => df.id || df.name));
  }, [deadFunctions]);

  // Mouse drag handling (Pan canvas or Drag node)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target !== containerRef.current && (e.target as HTMLElement).tagName !== 'svg') {
      return;
    }

    clickStartPos.current = { x: e.clientX, y: e.clientY };
    hasMovedPan.current = false;
    isPanning.current = true;
    panStart.current = {
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y,
    };
    setIsCurrentlyPanning(true);
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    clickStartPos.current = { x: e.clientX, y: e.clientY };
    hasMovedPan.current = false;

    selectNode(node);

    const currentPos = effectivePositions.get(node.id) || { x: 0, y: 0 };
    draggedNode.current = {
      id: node.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startNodeX: currentPos.x,
      startNodeY: currentPos.y,
    };
    setActiveDraggingId(node.id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Dragging Node
    if (draggedNode.current) {
      const dx = (e.clientX - draggedNode.current.startMouseX) / zoom;
      const dy = (e.clientY - draggedNode.current.startMouseY) / zoom;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMovedPan.current = true;
      }
      updateNodePosition(draggedNode.current.id, {
        x: Math.round(draggedNode.current.startNodeX + dx),
        y: Math.round(draggedNode.current.startNodeY + dy),
      });
      return;
    }

    // 2. Panning Canvas
    if (isPanning.current) {
      const dx = e.clientX - clickStartPos.current.x;
      const dy = e.clientY - clickStartPos.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hasMovedPan.current = true;
      }
      setPanOffset({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    }
  };

  const handleMouseUp = () => {
    // Click on background canvas (without dragging) minimizes sidebars
    if (isPanning.current && !hasMovedPan.current) {
      minimizeAllPanels();
    }

    isPanning.current = false;
    setIsCurrentlyPanning(false);
    draggedNode.current = null;
    setActiveDraggingId(null);
  };

  // Canvas zoom with mouse wheel
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      adjustZoom(delta);
    }
  };

  const isDimmed = focusMode || isEditorFocused;

  return (
    <main
      ref={containerRef}
      id="canvasContainer"
      className={`absolute inset-0 w-full h-full bg-[#1e1e1e] overflow-hidden select-none ${
        activeDraggingId || isCurrentlyPanning
          ? 'cursor-grabbing'
          : 'cursor-grab'
      }`}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* VS Code Subtle Dot Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #2d2d2d 1.2px, transparent 1.2px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* TOP FLOATING OPTIONS HUD */}
      <div
        className={`absolute top-14 left-1/2 -translate-x-1/2 z-30 transition-all duration-200 pointer-events-auto ${
          isDimmed
            ? 'opacity-25 hover:opacity-100 scale-95'
            : 'opacity-100 scale-100'
        }`}
      >
        <div className="bg-[#252526] border border-[#3e3e42] rounded-[3px] px-2.5 py-1 shadow-lg flex items-center gap-2">
          {/* Target Focus Chip */}
          <div className="flex items-center space-x-1.5 px-2 py-0.5 bg-[#1e1e1e] rounded-[2px] border border-[#3e3e42] text-[11px] font-mono">
            <span className="text-[#858585]">Focus:</span>
            <span className="font-medium text-[#dcdcaa] truncate max-w-[130px]">
              {selectedNode ? selectedNode.name : 'All Symbols'}
            </span>
          </div>

          <div className="h-4 w-[1px] bg-[#3e3e42]" />

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-[#1e1e1e] p-0.5 rounded-[2px] border border-[#3e3e42]">
            {(
              [
                { id: 'default', label: 'Architecture', icon: 'account_tree' },
                { id: 'impact', label: 'Impact', icon: 'radar' },
                { id: 'cycles', label: 'Cycles', icon: 'change_circle' },
                { id: 'deadcode', label: 'Dead Code', icon: 'remove_done' },
              ] as const
            ).map((m) => {
              const active = analysisMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setAnalysisMode(m.id as AnalysisMode)}
                  className={`px-2 py-0.5 rounded-[2px] text-[11px] font-sans flex items-center gap-1 transition-colors ${
                    active
                      ? 'bg-[#094771] text-[#ffffff] font-medium border border-[#007acc]'
                      : 'text-[#cccccc] hover:text-[#ffffff] hover:bg-[#2a2d2e]'
                  }`}
                  title={`${m.label} Mode`}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                    {m.icon}
                  </span>
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              );
            })}
          </div>

          <div className="h-4 w-[1px] bg-[#3e3e42]" />

          {/* Depth Slider */}
          <div className="flex items-center gap-1 px-1 text-[11px] font-mono text-[#858585]">
            <span>Hops:</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4].map((d) => (
                <button
                  key={d}
                  onClick={() => setDepthHops(d)}
                  className={`w-4 h-4 rounded-[2px] text-[10px] flex items-center justify-center font-bold transition-colors ${
                    depthHops === d
                      ? 'bg-[#094771] text-[#ffffff] border border-[#007acc]'
                      : 'text-[#858585] hover:text-[#cccccc] hover:bg-[#2a2d2e]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="h-4 w-[1px] bg-[#3e3e42]" />

          {/* Reset / Reorganize Layout Button */}
          <button
            onClick={() => {
              resetNodePositions();
              handleFitView();
            }}
            className="p-1 text-[#cccccc] hover:text-[#ffffff] hover:bg-[#2a2d2e] rounded-[2px] transition-colors text-[11px]"
            title="Auto-organize / Reset Node Layout"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              reorder
            </span>
          </button>

          {/* Focus / Zen Mode Button */}
          <button
            onClick={toggleFocusMode}
            className={`p-1 rounded-[2px] text-[11px] flex items-center transition-colors ${
              focusMode
                ? 'bg-[#094771] text-[#ffffff] border border-[#007acc]'
                : 'text-[#cccccc] hover:text-[#ffffff] hover:bg-[#2a2d2e]'
            }`}
            title={focusMode ? 'Exit Zen Mode' : 'Enter Zen Mode'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              {focusMode ? 'visibility_off' : 'center_focus_strong'}
            </span>
          </button>
        </div>
      </div>

      {/* BOTTOM FLOATING CANVAS TOOLBAR */}
      <div
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-30 transition-all duration-200 pointer-events-auto ${
          isDimmed ? 'opacity-25 hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div className="bg-[#252526] border border-[#3e3e42] rounded-[3px] px-2 py-1 shadow-lg flex items-center gap-1">
          <button
            onClick={() => adjustZoom(-0.1)}
            className="p-1 text-[#cccccc] hover:text-[#ffffff] hover:bg-[#2a2d2e] rounded-[2px] transition-colors"
            title="Zoom Out"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              remove
            </span>
          </button>

          <span
            onClick={resetZoom}
            className="font-mono text-[11px] text-[#cccccc] hover:text-[#ffffff] px-1 cursor-pointer select-none"
            title="Reset Zoom to 100%"
          >
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={() => adjustZoom(0.1)}
            className="p-1 text-[#cccccc] hover:text-[#ffffff] hover:bg-[#2a2d2e] rounded-[2px] transition-colors"
            title="Zoom In"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              add
            </span>
          </button>

          <div className="h-4 w-[1px] bg-[#3e3e42] mx-0.5" />

          <button
            onClick={handleFitView}
            className="p-1 text-[#cccccc] hover:text-[#ffffff] hover:bg-[#2a2d2e] rounded-[2px] transition-colors"
            title="Fit Graph to Screen"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              fit_screen
            </span>
          </button>

          <button
            onClick={togglePan}
            className={`p-1 rounded-[2px] transition-colors ${
              panActive
                ? 'bg-[#094771] text-[#ffffff] border border-[#007acc]'
                : 'text-[#cccccc] hover:text-[#ffffff] hover:bg-[#2a2d2e]'
            }`}
            title="Toggle Pan Hand Tool"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              pan_tool
            </span>
          </button>
        </div>
      </div>

      {/* EMPTY / LOADING / ERROR SKELETON */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-auto">
          {isLoading ? (
            <div className="bg-[#252526] border border-[#3e3e42] rounded-[3px] p-6 shadow-xl max-w-sm flex flex-col items-center gap-3">
              <div className="w-5 h-5 border-2 border-[#007acc] border-t-transparent rounded-full animate-spin" />
              <div className="text-xs font-semibold text-[#ffffff]">Analyzing Python Project...</div>
              <p className="text-[11px] text-[#858585] leading-relaxed">
                Parsing AST, extracting functions, classes, dependencies and McCabe cyclomatic complexity metrics.
              </p>
            </div>
          ) : error ? (
            <div className="bg-[#252526] border border-[#f14c4c]/40 rounded-[3px] p-6 shadow-xl max-w-md flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[#f14c4c] text-3xl">error</span>
              <div className="text-xs font-semibold text-[#ffffff]">Architecture Analysis Error</div>
              <p className="text-[11px] text-[#858585] leading-relaxed font-mono">
                {error}
              </p>
              <button
                onClick={() => loadProject(projectPath, true)}
                className="mt-2 bg-[#007acc] hover:bg-[#0098ff] text-[#ffffff] font-medium px-4 py-1.5 rounded-[2px] text-xs transition-colors"
              >
                Retry Analysis
              </button>
            </div>
          ) : (
            <div className="bg-[#252526] border border-[#3e3e42] rounded-[3px] p-6 shadow-xl max-w-sm flex flex-col items-center gap-3">
              <span className="material-symbols-outlined text-[#858585] text-3xl">folder_off</span>
              <div className="text-xs font-semibold text-[#ffffff]">No Python Symbols Discovered</div>
              <p className="text-[11px] text-[#858585] leading-relaxed">
                No valid Python files were detected in this folder. Open another folder or select the sample project.
              </p>
              <button
                onClick={() => loadProject('sample_project', true)}
                className="mt-2 bg-[#007acc] hover:bg-[#0098ff] text-[#ffffff] font-medium px-4 py-1.5 rounded-[2px] text-xs transition-colors"
              >
                Load Sample Project
              </button>
            </div>
          )}
        </div>
      )}

      {/* GRAPH CANVAS VIEWPORT */}
      <div
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
          transformOrigin: '0 0',
          width: '5000px',
          height: '5000px',
        }}
        className="absolute top-0 left-0 pointer-events-none"
      >
        {/* SVG BEZIER CONNECTION CABLES */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
          <defs>
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#5a5a5a" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#007acc" />
            </marker>
            <marker
              id="arrow-cycle"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#cca700" />
            </marker>
          </defs>

          {edges.map((edge, idx) => {
            const sourcePos = effectivePositions.get(edge.source);
            const targetPos = effectivePositions.get(edge.target);
            if (!sourcePos || !targetPos) return null;

            // Connection points: right edge of source card to left edge of target card
            const startX = sourcePos.x + 220;
            const startY = sourcePos.y + 36;
            const endX = targetPos.x;
            const endY = targetPos.y + 36;

            const dx = endX - startX;
            const cp1X = startX + Math.max(dx * 0.45, 40);
            const cp1Y = startY;
            const cp2X = endX - Math.max(dx * 0.45, 40);
            const cp2Y = endY;

            const d = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

            const isEdgeActive =
              selectedNode &&
              (selectedNode.id === edge.source || selectedNode.id === edge.target);

            const isCycle =
              analysisMode === 'cycles' &&
              activeCycles.some(
                (c) => c.includes(edge.source) && c.includes(edge.target)
              );

            let strokeColor = '#454545';
            let strokeWidth = 1.2;
            let marker = 'url(#arrow-default)';
            let dashClass = '';

            if (isCycle) {
              strokeColor = '#cca700';
              strokeWidth = 2.0;
              marker = 'url(#arrow-cycle)';
              dashClass = 'cycle-cable';
            } else if (isEdgeActive) {
              strokeColor = '#007acc';
              strokeWidth = 1.8;
              marker = 'url(#arrow-active)';
              dashClass = 'flow-cable';
            }

            return (
              <path
                key={`${edge.source}-${edge.target}-${idx}`}
                d={d}
                fill="none"
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                className={dashClass}
                markerEnd={marker}
              />
            );
          })}
        </svg>

        {/* DRAGGABLE VS CODE STYLE GRAPH NODES */}
        {nodes.map((node) => {
          const pos = effectivePositions.get(node.id);
          if (!pos) return null;

          const isSelected = selectedNode?.id === node.id;
          const isConnected = activeNodeIds.has(node.id);
          const isDead = deadNodeIds.has(node.id);
          const isClass = node.kind === 'class';
          const isDragging = activeDraggingId === node.id;

          let borderClass = 'border-[#3e3e42] hover:border-[#606060]';
          let bgClass = 'bg-[#252526]';
          let opacityClass = 'opacity-100';

          if (isDragging) {
            borderClass = 'border-[#007acc] ring-1 ring-[#007acc] shadow-xl';
            bgClass = 'bg-[#2d2d30]';
          } else if (isSelected) {
            borderClass = 'border-[#007acc] ring-1 ring-[#007acc] shadow-lg';
            bgClass = 'bg-[#2d2d30]';
          } else if (isConnected) {
            borderClass = 'border-[#007acc]/70';
            bgClass = 'bg-[#252528]';
          } else if (analysisMode === 'deadcode' && isDead) {
            borderClass = 'border-[#f14c4c]';
            bgClass = 'bg-[#2b2020]';
          } else if (selectedNode && !isConnected) {
            opacityClass = 'opacity-35 hover:opacity-90';
          }

          return (
            <div
              key={node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                width: '220px',
              }}
              className={`absolute top-0 left-0 rounded-[3px] border p-2.5 cursor-grab active:cursor-grabbing transition-all duration-150 select-none shadow-md pointer-events-auto ${borderClass} ${bgClass} ${opacityClass}`}
            >
              {/* Header: Kind Badge, Tier & File */}
              <div className="flex items-center justify-between mb-1.5 pointer-events-none gap-1">
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[9px] font-mono px-1 py-0.2 rounded-[2px] uppercase font-semibold tracking-wider ${
                      isClass
                        ? 'bg-[#203330] text-[#4ec9b0] border border-[#2a4e48]'
                        : 'bg-[#333220] text-[#dcdcaa] border border-[#4d4a2a]'
                    }`}
                  >
                    {isClass ? 'class' : node.is_async ? 'async fn' : 'fn'}
                  </span>
                  {node.tier && (
                    <span className="text-[8px] font-mono px-1 py-0.2 rounded-[2px] bg-[#1e1e1e] text-[#858585] uppercase border border-[#3e3e42]">
                      {node.tier}
                    </span>
                  )}
                </div>

                <span className="text-[10px] font-mono text-[#858585] truncate max-w-[90px]">
                  {node.filename}
                </span>
              </div>

              {/* Symbol Name with VS Code syntax color */}
              <div className="font-mono text-xs font-semibold truncate flex items-center justify-between pointer-events-none">
                <div className="truncate">
                  <span className={isClass ? 'text-[#4ec9b0]' : 'text-[#dcdcaa]'}>
                    {node.name}
                  </span>
                  <span className="text-[#858585] font-normal">()</span>
                </div>
                <span
                  className="material-symbols-outlined text-[#858585] opacity-0 group-hover:opacity-100"
                  style={{ fontSize: 13 }}
                >
                  drag_indicator
                </span>
              </div>

              {/* Sub-meta: Lines, params, and Cyclomatic Complexity */}
              <div className="mt-2 pt-1.5 border-t border-[#3e3e42] flex items-center justify-between text-[10px] font-mono text-[#858585] pointer-events-none">
                <span>L{node.line}</span>
                <div className="flex items-center gap-1.5">
                  {node.cyclomatic_complexity !== undefined && node.cyclomatic_complexity !== null && (
                    <span
                      className={`text-[9px] px-1 rounded-[2px] font-semibold ${
                        node.complexity_rating === 'low'
                          ? 'text-[#4ec9b0] bg-[#203330]'
                          : node.complexity_rating === 'moderate'
                          ? 'text-[#cca700] bg-[#333020]'
                          : 'text-[#f14c4c] bg-[#332020]'
                      }`}
                    >
                      CC {node.cyclomatic_complexity}
                    </span>
                  )}
                  {Array.isArray(node.parameters) && node.parameters.length > 0 && (
                    <span className="text-[#858585]">
                      {node.parameters.length}p
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
};
