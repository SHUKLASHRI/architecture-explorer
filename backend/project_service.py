"""Domain service for project architecture analysis, file management, and refactoring."""

from __future__ import annotations

import ast
import os
import threading
from typing import Any, Optional

from backend.analyzer import find_circular_dependencies, find_dead_functions, impact_analysis
from backend.project_mapper import ProjectArchitectureMapper
from backend.refactor import apply_rename, plan_rename, verify_plan


class ProjectService:
    """Coordinates project inspection, caching, secure file operations, and refactoring."""

    def __init__(self, repo_root: Optional[str] = None):
        self.repo_root = os.path.abspath(repo_root or os.path.dirname(os.path.dirname(__file__)))
        self._lock = threading.Lock()
        self._cached_project_path: Optional[str] = None
        self._cached_result: Optional[dict[str, Any]] = None

    def resolve_project_root(self, path: Optional[str] = None) -> str:
        """Resolve project path to canonical absolute directory path."""
        p_str = (path or "").strip()
        if not p_str:
            with self._lock:
                if self._cached_project_path and os.path.isdir(self._cached_project_path):
                    return self._cached_project_path

            bundled = os.path.join(self.repo_root, "sample_project")
            if os.path.isdir(bundled):
                return os.path.abspath(bundled)
            return os.path.abspath(os.getcwd())

        # Relative to repo root
        cand_repo = os.path.join(self.repo_root, p_str)
        if os.path.isdir(cand_repo):
            return os.path.abspath(cand_repo)

        # Direct / absolute or relative to CWD
        cand_direct = os.path.abspath(p_str)
        if os.path.isdir(cand_direct):
            return cand_direct

        raise FileNotFoundError(f"Project directory not found: {p_str}")

    def resolve_safe_file_path(self, project_root: str, file_path: str, must_exist: bool = True) -> str:
        """Resolve a file path and ensure it does not escape the project root directory."""
        if not file_path or not file_path.strip():
            raise ValueError("File path cannot be empty")

        p = file_path.strip()
        if os.path.isabs(p):
            target = os.path.abspath(p)
        else:
            target = os.path.abspath(os.path.join(project_root, p))

        # Security check: path traversal prevention
        try:
            common = os.path.commonpath([target, project_root])
        except ValueError:
            raise PermissionError(f"Access denied: path is on a different drive than project root")

        if common != project_root:
            raise PermissionError(f"Access denied: '{file_path}' resolves outside project root")

        if must_exist and not os.path.isfile(target):
            raise FileNotFoundError(f"File not found: {file_path}")

        return target

    def get_analysis(self, project_path: Optional[str] = None, force_refresh: bool = False) -> dict[str, Any]:
        """Return cached architecture analysis or run mapper if cache is cold or invalidated."""
        abs_path = self.resolve_project_root(project_path)

        with self._lock:
            if not force_refresh and self._cached_project_path == abs_path and self._cached_result is not None:
                return self._cached_result

        # Run architecture mapper outside the lock to prevent blocking concurrent readers
        mapper = ProjectArchitectureMapper(abs_path)
        project_map = mapper.generate_project_map()

        with self._lock:
            self._cached_project_path = abs_path
            self._cached_result = project_map
            return self._cached_result

    def invalidate_cache(self) -> None:
        """Clear cached analysis."""
        with self._lock:
            self._cached_project_path = None
            self._cached_result = None

    def get_source_snippet(
        self,
        project_path: Optional[str],
        file_path: str,
        line: int,
        context: int = 4,
    ) -> dict[str, Any]:
        """Read a slice of source lines centered around the target line number."""
        root = self.resolve_project_root(project_path)
        safe_path = self.resolve_safe_file_path(root, file_path, must_exist=True)

        if line < 1:
            line = 1

        with open(safe_path, "r", encoding="utf-8", errors="replace") as f:
            all_lines = f.readlines()

        start = max(0, line - 1 - context)
        end = min(len(all_lines), line + context)

        lines_out = [
            {
                "number": i + 1,
                "content": all_lines[i].rstrip("\r\n"),
                "is_target": (i + 1 == line),
            }
            for i in range(start, end)
        ]

        return {"lines": lines_out, "target_line": line}

    def get_file_content(self, project_path: Optional[str], file_path: str) -> dict[str, Any]:
        """Read full content of a source file."""
        root = self.resolve_project_root(project_path)
        safe_path = self.resolve_safe_file_path(root, file_path, must_exist=True)

        with open(safe_path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()

        rel_path = os.path.relpath(safe_path, root).replace("\\", "/")
        return {
            "file": safe_path,
            "rel_path": rel_path,
            "filename": os.path.basename(safe_path),
            "content": content,
            "lines_count": len(content.splitlines()),
        }

    def save_file_content(
        self,
        project_path: Optional[str],
        file_path: str,
        content: str,
    ) -> dict[str, Any]:
        """Validate syntax, write content to disk, and refresh architecture analysis."""
        root = self.resolve_project_root(project_path)
        safe_path = self.resolve_safe_file_path(root, file_path, must_exist=False)

        # Validate Python syntax if it is a python file
        if safe_path.endswith(".py"):
            try:
                ast.parse(content, filename=safe_path)
            except SyntaxError as e:
                return {
                    "success": False,
                    "error": f"Python SyntaxError on line {e.lineno}: {e.msg}",
                    "syntax_error": {
                        "line": e.lineno,
                        "offset": e.offset,
                        "text": e.text,
                        "message": e.msg,
                    },
                }

        os.makedirs(os.path.dirname(safe_path), exist_ok=True)
        with open(safe_path, "w", encoding="utf-8") as f:
            f.write(content)

        # Invalidate cache and re-analyze
        self.invalidate_cache()
        updated_map = self.get_analysis(root)

        return {
            "success": True,
            "message": f"Saved {os.path.basename(safe_path)} successfully",
            "project_map": updated_map,
        }

    def get_circular_dependencies(self, project_path: Optional[str] = None) -> dict[str, Any]:
        """Detect circular call/instantiation loops in the project."""
        analysis = self.get_analysis(project_path)
        cycles = analysis.get("diagnostics", {}).get("cycles")
        if cycles is None:
            cycles = find_circular_dependencies(analysis["graph"])
        return {"cycles": cycles, "count": len(cycles)}

    def get_dead_code(self, project_path: Optional[str] = None) -> dict[str, Any]:
        """Find functions with no incoming call edges."""
        analysis = self.get_analysis(project_path)
        dead = analysis.get("diagnostics", {}).get("dead_functions")
        if dead is None:
            dead = find_dead_functions(analysis["graph"])
        return {"dead_functions": dead, "count": len(dead)}

    def get_impact_analysis(self, project_path: Optional[str], node_id: str) -> dict[str, Any]:
        """Find transitive callers and callees for node_id."""
        analysis = self.get_analysis(project_path)
        return impact_analysis(analysis["graph"], node_id)

    def preview_rename(
        self,
        project_path: Optional[str],
        node_id: str,
        new_name: str,
    ) -> dict[str, Any]:
        """Build and verify a rename substitution plan."""
        analysis = self.get_analysis(project_path)
        plan = plan_rename(
            graph=analysis["graph"],
            target_node_id=node_id,
            new_name=new_name,
        )

        if not plan.get("ok"):
            return plan

        verification = verify_plan(plan)
        plan["verified"] = verification.get("ok", False)
        if not verification.get("ok"):
            plan["verification_failures"] = verification.get("failures", [])

        return plan

    def apply_rename(
        self,
        project_path: Optional[str],
        node_id: str,
        new_name: str,
    ) -> dict[str, Any]:
        """Execute verified rename substitution across files, refresh analysis, and return updated graph."""
        analysis = self.get_analysis(project_path)
        plan = plan_rename(
            graph=analysis["graph"],
            target_node_id=node_id,
            new_name=new_name,
        )
        if not plan.get("ok"):
            return {"success": False, "error": plan.get("error", "Failed to plan rename")}

        verification = verify_plan(plan)
        if not verification.get("ok"):
            return {
                "success": False,
                "error": verification.get("error", "Verification failed"),
                "failures": verification.get("failures", []),
            }

        apply_res = apply_rename(plan)
        if not apply_res.get("success"):
            return apply_res

        # Refresh project analysis
        abs_root = self.resolve_project_root(project_path)
        self.invalidate_cache()
        new_analysis = self.get_analysis(abs_root)
        summary = new_analysis.get("summary", {})

        return {
            "success": True,
            "files_modified": apply_res.get("files_modified", []),
            "nodes": new_analysis.get("nodes", []),
            "edges": new_analysis.get("edges", []),
            "summary": {
                "total_nodes": summary.get("total_nodes", len(new_analysis.get("nodes", []))),
                "total_edges": summary.get("total_edges", len(new_analysis.get("edges", []))),
                "files_parsed": summary.get("total_files", 0),
                "resolved": summary.get("resolved_calls", 0),
                "ambiguous": summary.get("ambiguous_count", 0),
                "unresolved": summary.get("unresolved_count", 0),
            },
        }


# Global default service instance
service = ProjectService()
