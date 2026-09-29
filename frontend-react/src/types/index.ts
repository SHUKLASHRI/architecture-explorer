/**
 * PyArch Studio - TypeScript Types & Interfaces
 */

export interface ParameterInfo {
  name: string;
  type?: string | null;
  default?: string | null;
  kind?: string;
}

export interface GraphNode {
  id: string;
  name: string;
  kind: 'function' | 'class';
  file: string;
  filename: string;
  rel_path?: string;
  module?: string;
  line: number;
  end_line?: number;
  col?: number;
  loc?: number;
  class_owner: string | null;
  args?: string[];
  bases?: string[];
  docstring?: string | null;
  signature?: string;
  parameters?: ParameterInfo[];
  return_type?: string | null;
  decorators?: string[];
  cyclomatic_complexity?: number;
  complexity_rating?: 'low' | 'moderate' | 'high' | 'critical';
  tier?: 'presentation' | 'services' | 'persistence' | 'utilities' | 'core';
  is_async?: boolean;
  is_method?: boolean;
  parent_class?: string | null;
  methods?: string[];
  fields?: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'calls' | 'instantiates' | 'inherits';
  file?: string;
  line?: number;
}

export interface AnalysisSummary {
  total_nodes: number;
  total_edges: number;
  total_files?: number;
  total_lines?: number;
  total_code_lines?: number;
  total_classes?: number;
  total_functions?: number;
  circular_cycles_count?: number;
  dead_functions_count?: number;
  files_parsed?: number;
  resolved?: number;
  ambiguous?: number;
  unresolved?: number;
  resolved_calls?: number;
  unresolved_calls?: number;
}

export interface ModuleConstant {
  name: string;
  line: number;
  value_repr: string;
}

export interface ModuleImport {
  module: string;
  names: string[];
  is_from: boolean;
  level: number;
}

export interface ModuleCoupling {
  afferent_coupling_ca: number;
  efferent_coupling_ce: number;
  instability_metric: number;
}

export interface ProjectModule {
  module_name: string;
  filename: string;
  rel_path: string;
  docstring?: string | null;
  is_package_init: boolean;
  has_main_block: boolean;
  constants: ModuleConstant[];
  imports: ModuleImport[];
  symbols_count: number;
  coupling: ModuleCoupling;
}

export interface ComplexityHotspot {
  id: string;
  name: string;
  file: string;
  line: number;
  complexity: number;
  rating: 'low' | 'moderate' | 'high' | 'critical';
}

export interface ProjectDiagnostics {
  cycles: string[][];
  dead_functions: DeadFunction[];
  hotspots: ComplexityHotspot[];
  coupling_metrics: Record<string, ModuleCoupling>;
}

export interface ProjectMeta {
  name: string;
  root_path: string;
  packages: string[];
  total_files: number;
  total_lines: number;
  total_code_lines: number;
}

export interface AnalyzeResponse {
  project?: ProjectMeta;
  modules?: ProjectModule[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  layers?: Record<string, string[]>;
  diagnostics?: ProjectDiagnostics;
  summary: AnalysisSummary;
  error?: string;
}

export interface SourceLine {
  number: number;
  content: string;
  is_target: boolean;
}

export interface SourceResponse {
  lines: SourceLine[];
  target_line: number;
  error?: string;
}

export interface CircularDepsResponse {
  cycles: string[][];
  count: number;
  error?: string;
}

export interface DeadFunction extends GraphNode {}

export interface DeadCodeResponse {
  dead_functions: DeadFunction[];
  count: number;
  error?: string;
}

export interface ImpactResponse {
  node: string;
  callers: string[];
  callees: string[];
  direct_callers: string[];
  direct_callees: string[];
  error?: string;
}

export interface RenameSubstitution {
  file: string;
  line: number;
  col: number;
  old: string;
  new: string;
}

export interface RenamePlan {
  ok: boolean;
  error?: string;
  node_id: string;
  old_name: string;
  new_name: string;
  substitutions: RenameSubstitution[];
  files_affected: string[];
  verified?: boolean;
}

export interface RenamePreviewResponse extends RenamePlan {}

export interface RenameApplyResponse {
  success: boolean;
  files_modified: string[];
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  summary?: AnalysisSummary;
  error?: string;
}

export type AnalysisMode = 'default' | 'impact' | 'cycles' | 'deadcode';
export type LayoutAlgorithm = 'Sugiyama' | 'Force-Directed';
export type SidebarTab = 'files' | 'symbols' | 'layers' | 'metrics';
export type CardDensity = 'compact' | 'standard' | 'detailed';

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export interface ToastNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
}
