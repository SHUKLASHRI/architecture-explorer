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
    layoutAlgorithm,
    toggleLayoutAlgorithm,
    zoom,
    adjustZoom,
    resetZoom,
    panActive,
    togglePan,
    depthHops,
    setDepthHops,
    activeCycles,
    deadFunctions,
    impact,
    focusMode,
    toggleFocusMode,
    isEditorFocused,
    nodeCustomPositions,
    updateNodePosition,
    resetNodePositions,
    minimizeAllPanels,
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
    const xMargin = 100;
    const availableWidth = Math.max(containerSize.width - 2 * xMargin, 680);
    const colSpacing = availableWidth / (colCount - 1 || 1);

    tiers.forEach((tierNodes, colIdx) => {
      const x = xMargin + colIdx * colSpacing;
      const rowCount = tierNodes.length;
      const ySpacing = 140;
      const totalColHeight = (rowCount - 1) * ySpacing;
      const startY = Math.max((containerSize.height - totalColHeight) / 2, 80);

      tierNodes.forEach((node, rowIdx) => {
        posMap.set(node.id, {
          x: Math.round(x),
          y: Math.round(startY + rowIdx * ySpacing),
        });
      });
    });

    return posMap;
  }, [nodes, containerSize]);

  // Combined positions: base positions + user-dragged custom overrides
  const effectivePositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    baseNodePositions.forEach((pos, id) => {
      map.set(id, pos);
    });
    Object.entries(nodeCustomPositions).forEach(([id, pos]) => {
      map.set(id, pos);
    });
    return map;
  }, [baseNodePositions, nodeCustomPositions]);

  // Center & Fit View functionality
  const handleFitView = useCallback(() => {
    if (nodes.length === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    effectivePositions.forEach((pos) => {
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + 230);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y + 90);
    });

    const graphWidth = maxX - minX;
    const graphHeight = maxY - minY;

    if (graphWidth <= 0 || graphHeight <= 0) return;

    const padding = 120;
    const scaleX = (containerSize.width - padding) / graphWidth;
    const scaleY = (containerSize.height - padding) / graphHeight;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.5), 1.15);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const offsetX = containerSize.width / 2 - centerX * newZoom;
    const offsetY = containerSize.height / 2 - centerY * newZoom;

    setPanOffset({ x: Math.round(offsetX), y: Math.round(offsetY) });
  }, [containerSize, effectivePositions, nodes.length]);

  // Auto-fit on initial load
  useEffect(() => {
    if (nodes.length > 0) {
      handleFitView();
    }
  }, [nodes.length]);

  // Canvas Mouse Down (Simply click and move cursor to pan the canvas/editor)
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only primary button (left click) or middle button
    if (e.button === 0 || e.button === 1 || e.altKey) {
      isPanning.current = true;
      hasMovedPan.current = false;
      clickStartPos.current = { x: e.clientX, y: e.clientY };
      panStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
      setIsCurrentlyPanning(true);
    }
  };

  // Node Drag Start
  const handleNodeMouseDown = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
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

  // Global Mouse Move (Canvas pan or Node drag)
  const handleMouseMove = (e: React.MouseEvent) => {
    if (draggedNode.current) {
      // Delta in screen pixels adjusted by canvas zoom scale
      const deltaX = (e.clientX - draggedNode.current.startMouseX) / zoom;
      const deltaY = (e.clientY - draggedNode.current.startMouseY) / zoom;

      const newX = Math.round(draggedNode.current.startNodeX + deltaX);
      const newY = Math.round(draggedNode.current.startNodeY + deltaY);

      updateNodePosition(draggedNode.current.id, { x: newX, y: newY });
      return;
    }

    if (isPanning.current) {
      const dist = Math.hypot(e.clientX - clickStartPos.current.x, e.clientY - clickStartPos.current.y);
      if (dist > 3) {
        hasMovedPan.current = true;
      }
      setPanOffset({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    }
  };

  // Global Mouse Up
  const handleMouseUp = () => {
    if (isPanning.current) {
      if (!hasMovedPan.current) {
        // Was a simple click on canvas without dragging -> auto-minimize peeks & deselect
        minimizeAllPanels();
        selectNode(null);
      }
      isPanning.current = false;
      setIsCurrentlyPanning(false);
    }
    draggedNode.current = null;
    setActiveDraggingId(null);
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      adjustZoom(delta);
    }
  };

  // Set of connected nodes for highlighting
  const activeNodeIds = useMemo(() => {
    const set = new Set<string>();
    if (!selectedNode) return set;
    set.add(selectedNode.id);

    if (impact) {
      impact.direct_callers?.forEach((id) => set.add(id));
      impact.direct_callees?.forEach((id) => set.add(id));
    }
    return set;
  }, [selectedNode, impact]);

  const deadNodeIds = useMemo(() => {
    return new Set(deadFunctions.map((d) => d.id));
  }, [deadFunctions]);

  const isDimmed = focusMode || isEditorFocused;

  return (
    <main
      ref={containerRef}
      id="canvasContainer"
      className={`absolute inset-0 w-full h-full bg-[#09090b] overflow-hidden select-none ${
        activeDraggingId || isCurrentlyPanning
          ? 'cursor-grabbing'
          : 'cursor-grab'
      }`}
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Subtle Dot Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, #27272a 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          opacity: 0.55,
        }}
      />

      {/* TOP FLOATING OPTIONS HUD */}
      <div
        className={`absolute top-4 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 pointer-events-auto ${
          isDimmed
            ? 'opacity-25 hover:opacity-100 scale-95'
            : 'opacity-100 scale-100'
        }`}
      >
        <div className="bg-[#121216]/85 backdrop-blur-xl border border-white/10 rounded-2xl px-3 py-1.5 shadow-2xl flex items-center gap-2">
          {/* Target Focus Chip */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-[#181820] rounded-xl border border-white/5 text-[11px] font-mono">
            <span className="text-zinc-500 font-medium">Focus:</span>
            <span className="font-semibold text-blue-400 truncate max-w-[140px]">
              {selectedNode ? selectedNode.name : 'Full Architecture'}
            </span>
          </div>

          <div className="h-4 w-[1px] bg-zinc-800" />

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-[#181820] p-0.5 rounded-xl border border-white/5">
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
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                    active
                      ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
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

          <div className="h-4 w-[1px] bg-zinc-800" />

          {/* Depth Slider */}
          <div className="flex items-center gap-1.5 px-1 text-[11px] font-mono text-zinc-400">
            <span className="text-zinc-500">Hops:</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4].map((d) => (
                <button
                  key={d}
                  onClick={() => setDepthHops(d)}
                  className={`w-5 h-5 rounded-md text-[10px] flex items-center justify-center font-bold transition-all ${
                    depthHops === d
                      ? 'bg-zinc-700 text-white'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="h-4 w-[1px] bg-zinc-800" />

          {/* Reset / Reorganize Layout Button */}
          <button
            onClick={() => {
              resetNodePositions();
              handleFitView();
            }}
            className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 rounded-lg transition-colors text-[11px]"
            title="Auto-organize / Reset Node Layout"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>
              reorder
            </span>
          </button>

          {/* Focus / Zen Mode Button */}
          <button
            onClick={toggleFocusMode}
            className={`p-1.5 rounded-lg text-[11px] flex items-center transition-colors ${
              focusMode
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
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
        className={`absolute bottom-5 left-1/2 -translate-x-1/2 z-30 transition-all duration-300 pointer-events-auto ${
          isDimmed ? 'opacity-25 hover:opacity-100' : 'opacity-100'
        }`}
      >
        <div className="bg-[#121216]/85 backdrop-blur-xl border border-white/10 rounded-2xl px-2.5 py-1.5 shadow-2xl flex items-center gap-1.5">
          <button
            onClick={() => adjustZoom(-0.1)}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-lg transition-colors"
            title="Zoom Out"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              remove
            </span>
          </button>

          <span
            onClick={resetZoom}
            className="font-mono text-[11px] text-zinc-400 hover:text-zinc-100 px-1 cursor-pointer select-none"
            title="Reset Zoom to 100%"
          >
            {Math.round(zoom * 100)}%
          </span>

          <button
            onClick={() => adjustZoom(0.1)}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-lg transition-colors"
            title="Zoom In"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              add
            </span>
          </button>

          <div className="h-4 w-[1px] bg-zinc-800 mx-0.5" />

          <button
            onClick={handleFitView}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-lg transition-colors"
            title="Fit Graph to Screen"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              fit_screen
            </span>
          </button>

          <button
            onClick={togglePan}
            className={`p-1.5 rounded-lg transition-colors ${
              panActive
                ? 'bg-blue-600 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
            }`}
            title="Toggle Pan Mode (or Alt+Drag)"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              pan_tool
            </span>
          </button>

          <button
            onClick={toggleLayoutAlgorithm}
            className="p-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 rounded-lg transition-colors"
            title={`Toggle Layout: ${layoutAlgorithm}`}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              auto_awesome_motion
            </span>
          </button>
        </div>
      </div>

      {/* SVG Canvas & Node Elements with Pan / Zoom transform */}
      <div
        className="w-full h-full transform-gpu origin-top-left"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
        }}
      >
        {/* SVG Bezier Connection Ribbons */}
        <svg className="absolute inset-0 w-[6000px] h-[6000px] pointer-events-none overflow-visible">
          <defs>
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#3f3f46" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#3b82f6" />
            </marker>
            <marker
              id="arrow-cycle"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 8 5 L 0 9 z" fill="#f59e0b" />
            </marker>
          </defs>

          {edges.map((edge, idx) => {
            const sourcePos = effectivePositions.get(edge.source);
            const targetPos = effectivePositions.get(edge.target);
            if (!sourcePos || !targetPos) return null;

            // Connection points: right edge of source card to left edge of target card
            const startX = sourcePos.x + 220;
            const startY = sourcePos.y + 40;
            const endX = targetPos.x;
            const endY = targetPos.y + 40;

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

            let strokeColor = '#3f3f46';
            let strokeWidth = 1.5;
            let marker = 'url(#arrow-default)';
            let dashClass = '';

            if (isCycle) {
              strokeColor = '#f59e0b';
              strokeWidth = 2.2;
              marker = 'url(#arrow-cycle)';
              dashClass = 'cycle-cable';
            } else if (isEdgeActive) {
              strokeColor = '#3b82f6';
              strokeWidth = 2;
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

        {/* DRAGGABLE GRAPH NODES */}
        {nodes.map((node) => {
          const pos = effectivePositions.get(node.id);
          if (!pos) return null;

          const isSelected = selectedNode?.id === node.id;
          const isConnected = activeNodeIds.has(node.id);
          const isDead = deadNodeIds.has(node.id);
          const isClass = node.kind === 'class';
          const isDragging = activeDraggingId === node.id;

          let borderClass = 'border-white/10 hover:border-zinc-500';
          let bgClass = 'bg-[#121217]/95 backdrop-blur-md';
          let opacityClass = 'opacity-100';

          if (isDragging) {
            borderClass = 'border-blue-400 ring-2 ring-blue-500/50 shadow-2xl scale-105';
            bgClass = 'bg-[#161622]';
          } else if (isSelected) {
            borderClass = 'border-blue-500 ring-1 ring-blue-500/50 shadow-xl shadow-blue-500/10';
            bgClass = 'bg-[#14141e]';
          } else if (isConnected) {
            borderClass = 'border-blue-500/40';
            bgClass = 'bg-[#13131a]';
          } else if (analysisMode === 'deadcode' && isDead) {
            borderClass = 'border-rose-500/60';
            bgClass = 'bg-[#1a1215]';
          } else if (selectedNode && !isConnected) {
            opacityClass = 'opacity-40 hover:opacity-90';
          }

          return (
            <div
              key={node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              style={{
                transform: `translate(${pos.x}px, ${pos.y}px)`,
                width: '220px',
              }}
              className={`absolute top-0 left-0 rounded-2xl border p-3.5 cursor-grab active:cursor-grabbing transition-shadow duration-150 select-none shadow-lg ${borderClass} ${bgClass} ${opacityClass}`}
            >
              {/* Header: Kind Badge, Tier & File */}
              <div className="flex items-center justify-between mb-1.5 pointer-events-none gap-1">
                <div className="flex items-center gap-1">
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded-md uppercase font-semibold tracking-wider ${
                      isClass
                        ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {isClass ? 'class' : node.is_async ? 'async' : 'fn'}
                  </span>
                  {node.tier && (
                    <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-zinc-800/80 text-zinc-400 uppercase">
                      {node.tier}
                    </span>
                  )}
                </div>

                <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[90px]">
                  {node.filename}
                </span>
              </div>

              {/* Symbol Name with drag indicator */}
              <div className="font-mono text-xs font-semibold text-zinc-100 truncate flex items-center justify-between pointer-events-none">
                <div className="truncate">
                  <span>{node.name}</span>
                  <span className="text-zinc-500 font-normal">()</span>
                </div>
                <span
                  className="material-symbols-outlined text-zinc-600 opacity-0 group-hover:opacity-100"
                  style={{ fontSize: 13 }}
                >
                  drag_indicator
                </span>
              </div>

              {/* Sub-meta: Lines, params, and Cyclomatic Complexity */}
              <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-zinc-500 pointer-events-none">
                <span>L{node.line}</span>
                <div className="flex items-center gap-1.5">
                  {node.cyclomatic_complexity !== undefined && node.cyclomatic_complexity !== null && (
                    <span
                      className={`text-[9px] px-1 rounded font-semibold ${
                        node.complexity_rating === 'low'
                          ? 'text-emerald-400 bg-emerald-500/10'
                          : node.complexity_rating === 'moderate'
                          ? 'text-amber-400 bg-amber-500/10'
                          : 'text-rose-400 bg-rose-500/10'
                      }`}
                    >
                      CC {node.cyclomatic_complexity}
                    </span>
                  )}
                  {Array.isArray(node.parameters) && node.parameters.length > 0 && (
                    <span className="text-zinc-400">
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
