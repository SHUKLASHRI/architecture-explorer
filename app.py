"""
app.py — Local Flask API server for Architecture Explorer.

Endpoints:
  GET  /                           → serves frontend/index.html
  GET  /health                     → health check
  POST /analyze                    → parse project + build graph → JSON
  GET  /source                     → fetch source snippet for a node
  POST /analyze/circular-deps      → circular dependency detection
  POST /analyze/dead-code          → dead function detection
  GET  /analyze/impact             → impact analysis for a node
  POST /refactor/rename/preview    → plan a rename (no writes)
  POST /refactor/rename/apply      → apply a rename to disk

All endpoints that mutate state (apply rename) return the updated graph
so the frontend can refresh without a separate /analyze call.
"""

import os
import sys

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# Allow running from project root or from backend/
sys.path.insert(0, os.path.dirname(__file__))

from backend.graph_builder import build_graph_from_path
from backend.project_mapper import ProjectArchitectureMapper
from backend.analyzer import (
    find_circular_dependencies,
    find_dead_functions,
    impact_analysis,
)
from backend.refactor import plan_rename, verify_plan, apply_rename

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)   # allow browser/pywebview to call from any origin during dev

# In-memory cache of the last analysis result (project_path → result)
# Avoids re-parsing on every analysis sub-request.
_cache: dict = {
    "project_path": None,
    "result": None,
}


def _resolve_project_path(path: str = "") -> str:
    """
    Resolve a project path dynamically across any operating system (Windows, Linux, macOS).
    - If path is empty, falls back to:
        1. Cached project path if valid
        2. Bundled 'sample_project' relative to this script
        3. Current working directory
    - If path is relative, resolves relative to script root first, then CWD.
    - Returns normalized absolute path, or raises FileNotFoundError.
    """
    p_str = (path or "").strip()
    if not p_str:
        if _cache.get("project_path") and os.path.isdir(_cache["project_path"]):
            return _cache["project_path"]
        bundled = os.path.join(os.path.dirname(__file__), "sample_project")
        if os.path.isdir(bundled):
            return os.path.abspath(bundled)
        return os.path.abspath(os.getcwd())

    # Try relative to app.py directory
    cand1 = os.path.join(os.path.dirname(__file__), p_str)
    if os.path.isdir(cand1):
        return os.path.abspath(cand1)

    # Try as direct / absolute path or relative to current working directory
    cand2 = os.path.abspath(p_str)
    if os.path.isdir(cand2):
        return cand2

    raise FileNotFoundError(f"Project directory not found: {p_str}")


def _get_result(project_path: str = "") -> dict:
    """Return cached result if path unchanged, else re-analyse."""
    abs_path = _resolve_project_path(project_path)
    if _cache["project_path"] != abs_path or _cache["result"] is None:
        # 1. Run production-grade Project Architecture Mapper
        mapper = ProjectArchitectureMapper(abs_path)
        project_map = mapper.generate_project_map()
        
        # 2. Run legacy graph builder for refactor compatibility (plan_rename, etc.)
        try:
            legacy_res = build_graph_from_path(abs_path)
        except Exception:
            legacy_res = {
                "nodes": project_map["nodes"],
                "edges": project_map["edges"],
                "graph": mapper.G if hasattr(mapper, "G") else None,
                "parsed": {},
                "resolved": project_map["summary"].get("resolved_calls", 0),
                "ambiguous": [],
                "unresolved": [],
            }

        _cache["result"] = {
            "project_map": project_map,
            "project": project_map.get("project", {}),
            "modules": project_map.get("modules", []),
            "layers": project_map.get("layers", {}),
            "diagnostics": project_map.get("diagnostics", {}),
            "nodes": project_map.get("nodes", []),
            "edges": project_map.get("edges", []),
            "summary": {
                **project_map.get("summary", {}),
                "resolved": legacy_res.get("resolved", project_map["summary"].get("resolved_calls", 0)),
                "ambiguous": len(legacy_res.get("ambiguous", [])),
                "unresolved": len(legacy_res.get("unresolved", [])),
                "parse_errors": legacy_res.get("parsed", {}).get("parse_errors", []),
            },
            "project_graph": getattr(mapper, "G", legacy_res.get("graph")),
            "graph": legacy_res.get("graph"),
            "parsed": legacy_res.get("parsed", {}),
        }
        _cache["project_path"] = abs_path
    return _cache["result"]


def _invalidate_cache():
    _cache["project_path"] = None
    _cache["result"] = None


# ---------------------------------------------------------------------------
# Static frontend
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.route("/health")
def health():
    return jsonify({"status": "ok", "version": "1.0.0"})


# ---------------------------------------------------------------------------
# Core analysis
# ---------------------------------------------------------------------------

@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Parse a Python project and return its full dependency map and graph as JSON.

    Body: { "project_path": "/abs/or/rel/path/to/project" }
    """
    data = request.get_json(silent=True) or {}
    try:
        abs_path = _resolve_project_path(data.get("project_path", ""))
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404

    force_refresh = data.get("refresh", False)
    if force_refresh:
        _invalidate_cache()
    result = _get_result(abs_path)

    return jsonify({
        "project": result["project"],
        "modules": result["modules"],
        "nodes": result["nodes"],
        "edges": result["edges"],
        "layers": result["layers"],
        "diagnostics": result["diagnostics"],
        "summary": result["summary"],
    })


@app.route("/analyze/project-map", methods=["GET", "POST"])
def project_map():
    """
    Return the comprehensive, production-grade Project Architecture Map.
    Supports GET with query params or POST with JSON body.
    """
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        project_path = data.get("project_path", "")
    else:
        project_path = request.args.get("project_path", "")

    try:
        abs_path = _resolve_project_path(project_path)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404

    result = _get_result(abs_path)
    return jsonify(result["project_map"])


# ---------------------------------------------------------------------------
# Source preview
# ---------------------------------------------------------------------------

@app.route("/source")
def source():
    """
    Return a window of source lines around a given line number.

    Query params:
      file  — absolute or relative path to the source file
      line  — 1-indexed target line number
      context — number of context lines above/below (default 4)
    """
    file_path = request.args.get("file", "")
    line_str = request.args.get("line", "1")
    ctx = int(request.args.get("context", "4"))

    if not file_path:
        return jsonify({"error": "file parameter is required"}), 400

    # Resolve relative paths against cached project root if necessary
    if not os.path.isabs(file_path) and _cache.get("project_path"):
        cand = os.path.join(_cache["project_path"], file_path)
        if os.path.isfile(cand):
            file_path = cand

    if not os.path.isfile(file_path):
        return jsonify({"error": f"File not found: {file_path}"}), 404

    try:
        target_line = int(line_str)
    except ValueError:
        return jsonify({"error": "line must be an integer"}), 400

    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()
    except IOError as e:
        return jsonify({"error": str(e)}), 500

    start = max(0, target_line - 1 - ctx)
    end = min(len(all_lines), target_line + ctx)

    lines_out = []
    for i in range(start, end):
        lines_out.append({
            "number": i + 1,
            "content": all_lines[i].rstrip("\n"),
            "is_target": (i + 1 == target_line),
        })

    return jsonify({"lines": lines_out, "target_line": target_line})


# ---------------------------------------------------------------------------
# Analysis: circular dependencies
# ---------------------------------------------------------------------------

@app.route("/analyze/circular-deps", methods=["POST"])
def circular_deps():
    """
    Detect circular dependencies in the project's call graph.

    Body: { "project_path": "..." } (optional)
    Response: { "cycles": [[node_id, ...], ...], "count": int }
    """
    data = request.get_json(silent=True) or {}
    try:
        abs_path = _resolve_project_path(data.get("project_path", ""))
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404

    result = _get_result(abs_path)
    cycles = find_circular_dependencies(result["graph"])

    return jsonify({"cycles": cycles, "count": len(cycles)})


# ---------------------------------------------------------------------------
# Analysis: dead code
# ---------------------------------------------------------------------------

@app.route("/analyze/dead-code", methods=["POST"])
def dead_code():
    """
    Find functions that are never called within the project.

    Body: { "project_path": "..." } (optional)
    Response: { "dead_functions": [{ node attrs... }, ...], "count": int }
    """
    data = request.get_json(silent=True) or {}
    try:
        abs_path = _resolve_project_path(data.get("project_path", ""))
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404

    result = _get_result(abs_path)
    dead = find_dead_functions(result["graph"])

    return jsonify({"dead_functions": dead, "count": len(dead)})


# ---------------------------------------------------------------------------
# Analysis: impact analysis
# ---------------------------------------------------------------------------

@app.route("/analyze/impact")
def impact():
    """
    Return the callers and callees of a given node.

    Query params:
      node         — node ID
      project_path — project directory

    Response:
    {
      "node": str,
      "callers": [node_id, ...],
      "callees": [node_id, ...],
      "direct_callers": [...],
      "direct_callees": [...]
    }
    """
    node_id = request.args.get("node", "")
    project_path = request.args.get("project_path", "")

    if not node_id:
        return jsonify({"error": "node parameter is required"}), 400
    if not project_path:
        if _cache.get("project_path"):
            project_path = _cache["project_path"]
        else:
            return jsonify({"error": "project_path parameter is required"}), 400

    abs_path = os.path.abspath(project_path)
    if not os.path.isdir(abs_path):
        return jsonify({"error": f"Directory not found: {abs_path}"}), 404

    result = _get_result(abs_path)
    # Prefer project_mapper graph, fallback to legacy graph
    target_graph = result.get("project_graph") or result.get("graph")
    analysis = impact_analysis(target_graph, node_id)

    if analysis.get("error") and result.get("graph") is not None and result.get("graph") != target_graph:
        fallback_analysis = impact_analysis(result["graph"], node_id)
        if not fallback_analysis.get("error"):
            analysis = fallback_analysis

    return jsonify(analysis)


# ---------------------------------------------------------------------------
# Refactor: rename preview
# ---------------------------------------------------------------------------

@app.route("/refactor/rename/preview", methods=["POST"])
def rename_preview():
    """
    Build and return a rename substitution plan without writing anything.

    Body: { "project_path": "...", "node_id": "...", "new_name": "..." }

    Response:
    {
      "ok": bool,
      "old_name": str,
      "new_name": str,
      "substitutions": [
        { "file", "filename", "line", "col", "old_text", "new_text", "context", "display_line" }
      ]
    }
    """
    data = request.get_json(silent=True) or {}
    project_path = data.get("project_path", "")
    node_id = data.get("node_id", "")
    new_name = data.get("new_name", "")

    if not all([node_id, new_name]):
        return jsonify({"error": "node_id and new_name are required"}), 400

    try:
        abs_path = _resolve_project_path(project_path)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    result = _get_result(abs_path)

    plan = plan_rename(
        parsed=result["parsed"],
        graph=result["graph"],
        target_node_id=node_id,
        new_name=new_name,
    )

    if not plan["ok"]:
        return jsonify(plan), 400

    # Also run verification so the UI can show if offsets are stale
    verification = verify_plan(plan)
    plan["verified"] = verification["ok"]
    if not verification["ok"]:
        plan["verification_failures"] = verification.get("failures", [])

    return jsonify(plan)


# ---------------------------------------------------------------------------
# Refactor: rename apply
# ---------------------------------------------------------------------------

@app.route("/refactor/rename/apply", methods=["POST"])
def rename_apply():
    """
    Apply a rename to disk and return the updated graph.

    Body: { "project_path": "...", "node_id": "...", "new_name": "..." }

    Response on success:
    {
      "success": true,
      "files_modified": [...],
      "nodes": [...],   ← updated graph
      "edges": [...],
      "summary": {...}
    }

    Response on failure:
    { "success": false, "error": "..." }
    """
    data = request.get_json(silent=True) or {}
    project_path = data.get("project_path", "")
    node_id = data.get("node_id", "")
    new_name = data.get("new_name", "")

    if not all([node_id, new_name]):
        return jsonify({"error": "node_id and new_name are required"}), 400

    try:
        abs_path = _resolve_project_path(project_path)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    result = _get_result(abs_path)

    # Plan
    plan = plan_rename(
        parsed=result["parsed"],
        graph=result["graph"],
        target_node_id=node_id,
        new_name=new_name,
    )
    if not plan["ok"]:
        return jsonify({"success": False, "error": plan["error"]}), 400

    # Verify
    verification = verify_plan(plan)
    if not verification["ok"]:
        return jsonify({
            "success": False,
            "error": verification["error"],
            "failures": verification.get("failures", []),
        }), 409

    # Apply
    apply_result = apply_rename(plan)
    if not apply_result["success"]:
        return jsonify(apply_result), 500

    # Invalidate cache and re-analyse so response contains updated graph
    _invalidate_cache()
    new_result = _get_result(abs_path)
    parsed = new_result.get("parsed", {})

    return jsonify({
        "success": True,
        "files_modified": apply_result["files_modified"],
        "nodes": new_result["nodes"],
        "edges": new_result["edges"],
        "summary": {
            "total_nodes": len(new_result["nodes"]),
            "total_edges": len(new_result["edges"]),
            "files_parsed": parsed.get("files_parsed", 0),
            "resolved": new_result["resolved"],
            "ambiguous": len(new_result["ambiguous"]),
            "unresolved": len(new_result["unresolved"]),
        },
    })


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5173))
    print(f"Architecture Explorer API -> http://localhost:{port}")
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
