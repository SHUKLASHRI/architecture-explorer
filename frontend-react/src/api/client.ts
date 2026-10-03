import type {
  AnalyzeResponse,
  SourceResponse,
  CircularDepsResponse,
  DeadCodeResponse,
  ImpactResponse,
  RenamePreviewResponse,
  RenameApplyResponse,
} from '../types';

// In dev with Vite proxy or production served by Flask, relative URL routes to Flask backend
const BASE_URL = '';

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 12000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw new Error(
      err.message || 'Cannot connect to backend server. Ensure python app.py is running.'
    );
  }
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${BASE_URL}/health`, {}, 4000);
    const data = await res.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

export async function analyzeProject(
  projectPath: string,
  forceRefresh = false
): Promise<AnalyzeResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_path: projectPath,
      refresh: forceRefresh,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}: Failed to analyze project`);
  }
  return res.json();
}

export async function fetchSourceSnippet(file: string, line: number): Promise<SourceResponse> {
  const res = await fetchWithTimeout(
    `${BASE_URL}/source?file=${encodeURIComponent(file)}&line=${line}`
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}: Could not load source snippet`);
  }
  return res.json();
}

export async function detectCircularDeps(projectPath: string): Promise<CircularDepsResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/analyze/circular-deps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_path: projectPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function detectDeadCode(projectPath: string): Promise<DeadCodeResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/analyze/dead-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_path: projectPath }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function analyzeImpact(nodeId: string): Promise<ImpactResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/analyze/impact?node=${encodeURIComponent(nodeId)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function previewRename(
  projectPath: string,
  nodeId: string,
  newName: string
): Promise<RenamePreviewResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/refactor/rename/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_path: projectPath,
      node_id: nodeId,
      new_name: newName,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function applyRename(
  projectPath: string,
  nodeId: string,
  newName: string
): Promise<RenameApplyResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/refactor/rename/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_path: projectPath,
      node_id: nodeId,
      new_name: newName,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export interface FileContentResponse {
  file: string;
  filename: string;
  content: string;
  lines_count: number;
}

export interface SaveFileResponse {
  success: boolean;
  message: string;
  project_map?: AnalyzeResponse;
  error?: string;
  syntax_error?: {
    line: number;
    offset: number;
    text?: string;
    message: string;
  };
}

export async function fetchFileContent(file: string): Promise<FileContentResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/file/content?file=${encodeURIComponent(file)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}: Failed to load file`);
  }
  return res.json();
}

export async function saveFileContent(
  file: string,
  content: string,
  projectPath?: string
): Promise<SaveFileResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/file/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file,
      content,
      project_path: projectPath || '',
    }),
  });

  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) {
    throw data;
  }
  return data;
}

export interface TerminalRunResponse {
  stdout: string;
  stderr: string;
  exit_code: number;
  cwd?: string;
  error?: string;
}

export async function executeTerminalCommand(
  command: string,
  projectPath?: string
): Promise<TerminalRunResponse> {
  const res = await fetchWithTimeout(`${BASE_URL}/terminal/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      command,
      project_path: projectPath || '',
    }),
  }, 22000);

  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) {
    throw data;
  }
  return data;
}


