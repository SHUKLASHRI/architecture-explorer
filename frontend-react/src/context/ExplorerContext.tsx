import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  GraphNode,
  GraphEdge,
  AnalysisSummary,
  AnalyzeResponse,
  SourceResponse,
  ImpactResponse,
  DeadFunction,
  AnalysisMode,
  LayoutAlgorithm,
  SidebarTab,
  ProjectModule,
  ProjectDiagnostics,
  ProjectMeta,
  CardDensity,
  ToastNotification,
} from '../types';
import * as api from '../api/client';

interface ExplorerContextType {
  projectPath: string;
  setProjectPath: (p: string) => void;
  nodes: GraphNode[];
  edges: GraphEdge[];
  modules: ProjectModule[];
  layers: Record<string, string[]>;
  diagnostics: ProjectDiagnostics | null;
  projectMeta: ProjectMeta | null;
  summary: AnalysisSummary | null;
  selectedNode: GraphNode | null;
  sourceSnippet: SourceResponse | null;
  impact: ImpactResponse | null;
  analysisMode: AnalysisMode;
  setAnalysisMode: (m: AnalysisMode) => void;
  layoutAlgorithm: LayoutAlgorithm;
  toggleLayoutAlgorithm: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  sidebarWidth: number;
  setSidebarWidth: React.Dispatch<React.SetStateAction<number>>;
  inspectorCollapsed: boolean;
  toggleInspector: () => void;
  inspectorWidth: number;
  setInspectorWidth: React.Dispatch<React.SetStateAction<number>>;
  focusMode: boolean;
  toggleFocusMode: () => void;
  isEditorFocused: boolean;
  setIsEditorFocused: (f: boolean) => void;
  sidebarTab: SidebarTab;
  setSidebarTab: (t: SidebarTab) => void;
  zoom: number;
  adjustZoom: (delta: number) => void;
  resetZoom: () => void;
  panActive: boolean;
  togglePan: () => void;
  depthHops: number;
  setDepthHops: (h: number) => void;
  activeCycles: string[][];
  deadFunctions: DeadFunction[];
  isLoading: boolean;
  isLoadingSource: boolean;
  error: string | null;
  clearError: () => void;
  sourceError: string | null;
  retrySourceSnippet: () => void;
  isSpotlightOpen: boolean;
  openSpotlight: () => void;
  closeSpotlight: () => void;
  renameModalNode: GraphNode | null;
  openRenameModal: (node: GraphNode) => void;
  closeRenameModal: () => void;
  apiConnected: boolean;

  // Visual Hierarchy & Cognitive Load controls
  cardDensity: CardDensity;
  setCardDensity: (d: CardDensity) => void;
  activeLayerFilter: string;
  setActiveLayerFilter: (l: string) => void;

  // Toast notification & Undo system
  toasts: ToastNotification[];
  showToast: (t: Omit<ToastNotification, 'id'>) => void;
  dismissToast: (id: string) => void;
  hasCustomPositions: boolean;
  undoResetLayout: () => void;

  nodeCustomPositions: Record<string, { x: number; y: number }>;
  updateNodePosition: (id: string, pos: { x: number; y: number }) => void;
  resetNodePositions: () => void;
  leftPanelOpen: boolean;
  setLeftPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  leftPanelHovered: boolean;
  setLeftPanelHovered: (v: boolean) => void;
  rightPanelOpen: boolean;
  setRightPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  rightPanelHovered: boolean;
  setRightPanelHovered: (v: boolean) => void;
  minimizeAllPanels: () => void;

  // Actions
  loadProject: (path?: string, forceRefresh?: boolean) => Promise<void>;
  selectNodeById: (nodeId: string) => void;
  selectNode: (node: GraphNode | null) => void;
  handleRenameSuccess: (data: any) => void;
}

const ExplorerContext = createContext<ExplorerContextType | null>(null);

const DEFAULT_SAMPLE_PATH = 'sample_project';

export const ExplorerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [projectPath, setProjectPath] = useState<string>(DEFAULT_SAMPLE_PATH);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [modules, setModules] = useState<ProjectModule[]>([]);
  const [layers, setLayers] = useState<Record<string, string[]>>({});
  const [diagnostics, setDiagnostics] = useState<ProjectDiagnostics | null>(null);
  const [projectMeta, setProjectMeta] = useState<ProjectMeta | null>(null);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [sourceSnippet, setSourceSnippet] = useState<SourceResponse | null>(null);
  const [impact, setImpact] = useState<ImpactResponse | null>(null);
  const [analysisMode, setAnalysisModeState] = useState<AnalysisMode>('default');
  const [layoutAlgorithm, setLayoutAlgorithm] = useState<LayoutAlgorithm>('Sugiyama');
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(260);
  const [inspectorCollapsed, setInspectorCollapsed] = useState<boolean>(false);
  const [inspectorWidth, setInspectorWidth] = useState<number>(380);
  const [focusMode, setFocusMode] = useState<boolean>(false);
  const [isEditorFocused, setIsEditorFocused] = useState<boolean>(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('files');
  const [zoom, setZoom] = useState<number>(1.0);
  const [panActive, setPanActive] = useState<boolean>(false);
  const [depthHops, setDepthHops] = useState<number>(2);
  const [activeCycles, setActiveCycles] = useState<string[][]>([]);
  const [deadFunctions, setDeadFunctions] = useState<DeadFunction[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingSource, setIsLoadingSource] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState<boolean>(false);
  const [renameModalNode, setRenameModalNode] = useState<GraphNode | null>(null);
  const [nodeCustomPositions, setNodeCustomPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [previousPositions, setPreviousPositions] = useState<Record<string, { x: number; y: number }> | null>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState<boolean>(true);
  const [leftPanelHovered, setLeftPanelHovered] = useState<boolean>(false);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(true);
  const [rightPanelHovered, setRightPanelHovered] = useState<boolean>(false);
  const [apiConnected, setApiConnected] = useState<boolean>(false);

  // Visual Hierarchy & Cognitive Load controls
  const [cardDensity, setCardDensity] = useState<CardDensity>('standard');
  const [activeLayerFilter, setActiveLayerFilter] = useState<string>('ALL');

  // Toast Notification & Undo system
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const showToast = useCallback((t: Omit<ToastNotification, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newToast: ToastNotification = { id, ...t };
    setToasts((prev) => [...prev.slice(-3), newToast]);
    const duration = t.duration || 4500;
    setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, duration);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // In-memory cache for 0ms instantaneous symbol inspection without network stutter
  const sourceCache = useRef<Map<string, SourceResponse>>(new Map());
  const impactCache = useRef<Map<string, ImpactResponse>>(new Map());
  const fetchTimeoutRef = useRef<any>(null);

  const clearError = useCallback(() => setError(null), []);

  // Poll health check (guarded to avoid unneeded state updates)
  useEffect(() => {
    api.checkHealth().then((ok) => setApiConnected((prev) => (prev === ok ? prev : ok)));
    const interval = setInterval(() => {
      api.checkHealth().then((ok) => setApiConnected((prev) => (prev === ok ? prev : ok)));
    }, 20000);
    return () => clearInterval(interval);
  }, []);

  // Global Keyboard shortcuts (⌘K / Ctrl+K / F2 / Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSpotlightOpen((prev) => !prev);
      }
      if (e.key === 'F2' && selectedNode) {
        e.preventDefault();
        setRenameModalNode(selectedNode);
      }
      if (e.key === 'Escape') {
        setIsSpotlightOpen(false);
        setRenameModalNode(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode]);

  // Load project AST from Flask
  const loadProject = useCallback(
    async (customPath?: string, forceRefresh = false) => {
      const targetPath = customPath || projectPath;
      setIsLoading(true);
      setError(null);
      sourceCache.current.clear();
      impactCache.current.clear();

      try {
        const data: AnalyzeResponse = await api.analyzeProject(targetPath, forceRefresh);
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
        setSummary(data.summary || null);
        if (data.modules) setModules(data.modules);
        if (data.layers) setLayers(data.layers);
        if (data.diagnostics) setDiagnostics(data.diagnostics);
        if (data.project) setProjectMeta(data.project);

        if (data.diagnostics?.cycles) {
          setActiveCycles(data.diagnostics.cycles);
        }
        if (data.diagnostics?.dead_functions) {
          setDeadFunctions(data.diagnostics.dead_functions);
        }

        // Auto-select a hero node if available
        if (data.nodes && data.nodes.length > 0) {
          const hero =
            data.nodes.find((n) => n.name.includes('validate') || n.name.includes('auth')) ||
            data.nodes[0];
          setSelectedNode(hero);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to analyze project AST');
      } finally {
        setIsLoading(false);
      }
    },
    [projectPath]
  );

  useEffect(() => {
    loadProject();
  }, []);

  // Fetch node source & impact whenever selectedNode changes (with cache & debounce)
  const fetchNodeDetails = useCallback((node: GraphNode, immediate = false) => {
    const srcKey = `${node.file}:${node.line}`;
    const cachedSrc = sourceCache.current.get(srcKey);
    const cachedImpact = impactCache.current.get(node.id);

    // If completely cached, update state immediately with zero network delay
    if (cachedSrc && cachedImpact) {
      setSourceSnippet(cachedSrc);
      setImpact(cachedImpact);
      setSourceError(null);
      setIsLoadingSource(false);
      return;
    }

    if (cachedSrc) setSourceSnippet(cachedSrc);
    if (cachedImpact) setImpact(cachedImpact);

    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }

    const executeFetch = () => {
      setIsLoadingSource(true);
      setSourceError(null);

      const promises: [Promise<any>, Promise<any>] = [
        cachedSrc ? Promise.resolve(cachedSrc) : api.fetchSourceSnippet(node.file, node.line),
        cachedImpact ? Promise.resolve(cachedImpact) : api.analyzeImpact(node.id),
      ];

      Promise.allSettled(promises).then(([srcRes, impactRes]) => {
        if (srcRes.status === 'fulfilled') {
          sourceCache.current.set(srcKey, srcRes.value);
          setSourceSnippet(srcRes.value);
        } else if (!cachedSrc) {
          setSourceSnippet(null);
          setSourceError(srcRes.reason?.message || 'Could not load source code');
        }
        if (impactRes.status === 'fulfilled') {
          impactCache.current.set(node.id, impactRes.value);
          setImpact(impactRes.value);
        } else if (!cachedImpact) {
          setImpact(null);
        }
        setIsLoadingSource(false);
      });
    };

    if (immediate) {
      executeFetch();
    } else {
      // 120ms debounce prevents network storm if user is starting a drag gesture
      fetchTimeoutRef.current = setTimeout(executeFetch, 120);
    }
  }, []);

  useEffect(() => {
    if (!selectedNode) {
      setSourceSnippet(null);
      setSourceError(null);
      setImpact(null);
      return;
    }
    fetchNodeDetails(selectedNode);
  }, [selectedNode, fetchNodeDetails]);

  const retrySourceSnippet = useCallback(() => {
    if (selectedNode) {
      const srcKey = `${selectedNode.file}:${selectedNode.line}`;
      sourceCache.current.delete(srcKey);
      impactCache.current.delete(selectedNode.id);
      fetchNodeDetails(selectedNode, true);
    }
  }, [selectedNode, fetchNodeDetails]);

  const selectNodeById = useCallback(
    (nodeId: string) => {
      const found = nodes.find((n) => n.id === nodeId || n.name === nodeId);
      if (found) {
        setSelectedNode(found);
      }
    },
    [nodes]
  );

  const setAnalysisMode = useCallback(
    async (mode: AnalysisMode) => {
      setAnalysisModeState(mode);
      if (mode === 'cycles' && activeCycles.length === 0) {
        try {
          const res = await api.detectCircularDeps(projectPath);
          setActiveCycles(res.cycles || []);
        } catch (e) {
          console.error(e);
        }
      } else if (mode === 'deadcode' && deadFunctions.length === 0) {
        try {
          const res = await api.detectDeadCode(projectPath);
          setDeadFunctions(res.dead_functions || []);
        } catch (e) {
          console.error(e);
        }
      }
    },
    [activeCycles.length, deadFunctions.length, projectPath]
  );

  const adjustZoom = useCallback((delta: number) => {
    setZoom((prev) => Math.min(Math.max(0.4, Number((prev + delta).toFixed(2))), 2.2));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(1.0);
  }, []);

  const togglePan = useCallback(() => {
    setPanActive((prev) => !prev);
  }, []);

  const toggleLayoutAlgorithm = useCallback(() => {
    setLayoutAlgorithm((prev) => (prev === 'Sugiyama' ? 'Force-Directed' : 'Sugiyama'));
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const toggleInspector = useCallback(() => {
    setInspectorCollapsed((prev) => !prev);
  }, []);

  const toggleFocusMode = useCallback(() => {
    setFocusMode((prev) => !prev);
  }, []);

  const updateNodePosition = useCallback((id: string, pos: { x: number; y: number }) => {
    setNodeCustomPositions((prev) => ({
      ...prev,
      [id]: pos,
    }));
  }, []);

  const hasCustomPositions = Object.keys(nodeCustomPositions).length > 0;

  const undoResetLayout = useCallback(() => {
    if (previousPositions) {
      setNodeCustomPositions(previousPositions);
      setPreviousPositions(null);
      showToast({
        type: 'success',
        message: 'Restored previous canvas layout positions.',
      });
    }
  }, [previousPositions, showToast]);

  const resetNodePositions = useCallback(() => {
    if (Object.keys(nodeCustomPositions).length > 0) {
      setPreviousPositions(nodeCustomPositions);
    }
    setNodeCustomPositions({});
    showToast({
      type: 'info',
      message: 'Layout auto-arranged into semantic columns.',
      actionLabel: 'Undo',
      onAction: () => {
        undoResetLayout();
      },
    });
  }, [nodeCustomPositions, showToast, undoResetLayout]);

  const minimizeAllPanels = useCallback(() => {
    setLeftPanelOpen(false);
    setRightPanelOpen(false);
    setLeftPanelHovered(false);
    setRightPanelHovered(false);
  }, []);

  const handleRenameSuccess = useCallback(
    (data: any) => {
      sourceCache.current.clear();
      impactCache.current.clear();
      if (data.nodes && data.edges) {
        setNodes(data.nodes);
        setEdges(data.edges);
        if (data.summary) setSummary(data.summary);
      } else {
        loadProject();
      }
      setRenameModalNode(null);
      showToast({
        type: 'success',
        message: 'Symbol successfully renamed across project files.',
      });
    },
    [loadProject, showToast]
  );

  return (
    <ExplorerContext.Provider
      value={{
        projectPath,
        setProjectPath,
        nodes,
        edges,
        modules,
        layers,
        diagnostics,
        projectMeta,
        summary,
        selectedNode,
        sourceSnippet,
        impact,
        analysisMode,
        setAnalysisMode,
        layoutAlgorithm,
        toggleLayoutAlgorithm,
        sidebarCollapsed,
        toggleSidebar,
        sidebarWidth,
        setSidebarWidth,
        inspectorCollapsed,
        toggleInspector,
        inspectorWidth,
        setInspectorWidth,
        focusMode,
        toggleFocusMode,
        isEditorFocused,
        setIsEditorFocused,
        sidebarTab,
        setSidebarTab,
        zoom,
        adjustZoom,
        resetZoom,
        panActive,
        togglePan,
        depthHops,
        setDepthHops,
        activeCycles,
        deadFunctions,
        isLoading,
        isLoadingSource,
        error,
        clearError,
        sourceError,
        retrySourceSnippet,
        isSpotlightOpen,
        openSpotlight: () => setIsSpotlightOpen(true),
        closeSpotlight: () => setIsSpotlightOpen(false),
        renameModalNode,
        openRenameModal: setRenameModalNode,
        closeRenameModal: () => setRenameModalNode(null),
        apiConnected,

        // Visual Hierarchy & Cognitive Load controls
        cardDensity,
        setCardDensity,
        activeLayerFilter,
        setActiveLayerFilter,

        // Toast notification & Undo system
        toasts,
        showToast,
        dismissToast,
        hasCustomPositions,
        undoResetLayout,

        nodeCustomPositions,
        updateNodePosition,
        resetNodePositions,
        leftPanelOpen,
        setLeftPanelOpen,
        leftPanelHovered,
        setLeftPanelHovered,
        rightPanelOpen,
        setRightPanelOpen,
        rightPanelHovered,
        setRightPanelHovered,
        minimizeAllPanels,
        loadProject,
        selectNodeById,
        selectNode: setSelectedNode,
        handleRenameSuccess,
      }}
    >
      {children}
    </ExplorerContext.Provider>
  );
};

export const useExplorer = () => {
  const ctx = useContext(ExplorerContext);
  if (!ctx) throw new Error('useExplorer must be used within an ExplorerProvider');
  return ctx;
};
