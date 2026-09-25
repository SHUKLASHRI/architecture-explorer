import type {
  AnalyzeResponse,
  SourceResponse,
  CircularDepsResponse,
  DeadCodeResponse,
  ImpactResponse,
  RenamePreviewResponse,
  RenameApplyResponse,
} from '../types';

// In dev with Vite proxy, empty base or relative URL routes to Flask backend
const BASE_URL = '';

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    const data = await res.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
}

export async function analyzeProject(projectPath: string): Promise<AnalyzeResponse> {
  const res = await fetch(`${BASE_URL}/analyze`, {
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

export async function fetchSourceSnippet(file: string, line: number): Promise<SourceResponse> {
  const res = await fetch(`${BASE_URL}/source?file=${encodeURIComponent(file)}&line=${line}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function detectCircularDeps(projectPath: string): Promise<CircularDepsResponse> {
  const res = await fetch(`${BASE_URL}/analyze/circular-deps`, {
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
  const res = await fetch(`${BASE_URL}/analyze/dead-code`, {
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
  const res = await fetch(`${BASE_URL}/analyze/impact?node=${encodeURIComponent(nodeId)}`);
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
  const res = await fetch(`${BASE_URL}/refactor/rename/preview`, {
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
  const res = await fetch(`${BASE_URL}/refactor/rename/apply`, {
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
