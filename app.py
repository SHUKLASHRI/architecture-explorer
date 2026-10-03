"""Flask application providing HTTP APIs for Irminsul IDE."""

from __future__ import annotations

import os
import sys
from typing import Any
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.project_service import service

FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
CORS(app)


# ---------------------------------------------------------------------------
# Static frontend routes
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def static_proxy(path: str):
    target = os.path.join(FRONTEND_DIR, path)
    if os.path.isfile(target):
        return send_from_directory(FRONTEND_DIR, path)
    return send_from_directory(FRONTEND_DIR, "index.html")


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.route("/health")
def health():
    return jsonify({"status": "ok", "version": "1.0.0"})


# ---------------------------------------------------------------------------
# Architecture analysis endpoints
# ---------------------------------------------------------------------------

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json(silent=True) or {}
    project_path = data.get("project_path", "")
    force_refresh = bool(data.get("refresh", False))

    try:
        result = service.get_analysis(project_path=project_path, force_refresh=force_refresh)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": f"Analysis failed: {e}"}), 500

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
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        project_path = data.get("project_path", "")
    else:
        project_path = request.args.get("project_path", "")

    try:
        result = service.get_analysis(project_path=project_path)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": f"Analysis failed: {e}"}), 500

    return jsonify(result)


@app.route("/source")
def source():
    file_path = request.args.get("file", "").strip()
    if not file_path:
        return jsonify({"error": "file parameter is required"}), 400

    line_param = request.args.get("line", "1")
    try:
        target_line = int(line_param)
    except ValueError:
        return jsonify({"error": "line parameter must be an integer"}), 400

    try:
        context_lines = int(request.args.get("context", "4"))
    except ValueError:
        context_lines = 4

    project_path = request.args.get("project_path")

    try:
        snippet = service.get_source_snippet(
            project_path=project_path,
            file_path=file_path,
            line=target_line,
            context=context_lines,
        )
        return jsonify(snippet)
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/file/content")
def file_content():
    file_path = request.args.get("file", "").strip()
    if not file_path:
        return jsonify({"error": "file parameter is required"}), 400

    project_path = request.args.get("project_path")

    try:
        content_info = service.get_file_content(project_path=project_path, file_path=file_path)
        return jsonify(content_info)
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/file/save", methods=["POST"])
def save_file():
    data = request.get_json(silent=True) or {}
    file_path = data.get("file", "").strip()
    content = data.get("content")
    project_path = data.get("project_path", "").strip()

    if not file_path:
        return jsonify({"error": "file parameter is required"}), 400
    if content is None:
        return jsonify({"error": "content parameter is required"}), 400

    try:
        res = service.save_file_content(
            project_path=project_path or None,
            file_path=file_path,
            content=content,
        )
        if not res.get("success"):
            return jsonify(res), 400
        return jsonify(res)
    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/analyze/circular-deps", methods=["POST"])
def circular_deps():
    data = request.get_json(silent=True) or {}
    project_path = data.get("project_path", "")

    try:
        res = service.get_circular_dependencies(project_path=project_path)
        return jsonify(res)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/analyze/dead-code", methods=["POST"])
def dead_code():
    data = request.get_json(silent=True) or {}
    project_path = data.get("project_path", "")

    try:
        res = service.get_dead_code(project_path=project_path)
        return jsonify(res)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/analyze/impact")
def impact():
    node_id = request.args.get("node", "").strip()
    project_path = request.args.get("project_path", "").strip()

    if not node_id:
        return jsonify({"error": "node parameter is required"}), 400

    try:
        res = service.get_impact_analysis(project_path=project_path or None, node_id=node_id)
        if res.get("error"):
            return jsonify(res), 404
        return jsonify(res)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Refactoring endpoints
# ---------------------------------------------------------------------------

@app.route("/refactor/rename/preview", methods=["POST"])
def rename_preview():
    data = request.get_json(silent=True) or {}
    project_path = data.get("project_path", "")
    node_id = data.get("node_id", "")
    new_name = data.get("new_name", "")

    if not node_id or not new_name:
        return jsonify({"error": "node_id and new_name are required"}), 400

    try:
        plan = service.preview_rename(project_path=project_path, node_id=node_id, new_name=new_name)
        if not plan.get("ok"):
            return jsonify(plan), 400
        return jsonify(plan)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/refactor/rename/apply", methods=["POST"])
def rename_apply():
    data = request.get_json(silent=True) or {}
    project_path = data.get("project_path", "")
    node_id = data.get("node_id", "")
    new_name = data.get("new_name", "")

    if not node_id or not new_name:
        return jsonify({"error": "node_id and new_name are required"}), 400

    try:
        result = service.apply_rename(project_path=project_path, node_id=node_id, new_name=new_name)
        if not result.get("success"):
            status_code = 409 if "Verification failed" in result.get("error", "") else 400
            return jsonify(result), status_code
        return jsonify(result)
    except FileNotFoundError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------------------------------------------
# Backwards-compatibility helpers for main.py / scripts
# ---------------------------------------------------------------------------

def _resolve_project_path(path: str = "") -> str:
    return service.resolve_project_root(path)


def _get_result(project_path: str = "") -> dict[str, Any]:
    return service.get_analysis(project_path)


def _invalidate_cache() -> None:
    service.invalidate_cache()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5173))
    print(f"Irminsul IDE API -> http://127.0.0.1:{port}")
    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
