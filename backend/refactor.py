"""Safe, AST-offset-based function and method renaming."""

from __future__ import annotations

import keyword
import os
from typing import Any, Optional
import networkx as nx


def _is_valid_identifier(name: str) -> bool:
    return name.isidentifier() and not keyword.iskeyword(name)


def _make_substitution(
    file_path: str,
    line: int,
    col: int,
    old_text: str,
    new_text: str,
    context: str,
) -> dict[str, Any]:
    display_context = ""
    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        if 1 <= line <= len(lines):
            display_context = lines[line - 1].rstrip()
    except IOError:
        pass

    return {
        "file": file_path,
        "filename": os.path.basename(file_path),
        "line": line,
        "col": col,
        "old_text": old_text,
        "new_text": new_text,
        "old": old_text,
        "new": new_text,
        "context": context,
        "display_line": display_context,
    }


def plan_rename(
    graph: nx.DiGraph,
    target_node_id: str,
    new_name: str,
    parsed: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    """Build a precise substitution plan for renaming a function or method.

    Returns plan dictionary with list of exact (file, line, col) substitutions.
    """
    if target_node_id not in graph.nodes:
        return {"ok": False, "error": f"Node '{target_node_id}' not found in graph."}

    node_data = graph.nodes[target_node_id]
    if node_data.get("kind") not in ("function", "async_function", "method"):
        return {"ok": False, "error": f"Node '{target_node_id}' is not a function or method."}

    old_name = node_data.get("name", "")
    if not _is_valid_identifier(new_name):
        return {"ok": False, "error": f"'{new_name}' is not a valid Python identifier."}

    if new_name == old_name:
        return {"ok": False, "error": "New name is identical to the current name."}

    file_path = os.path.abspath(node_data.get("file", ""))
    if not os.path.isfile(file_path):
        return {"ok": False, "error": f"Source file not found for node: {file_path}"}

    def_col = node_data.get("col", 0)
    def_line = node_data.get("line", 1)

    try:
        with open(file_path, "r", encoding="utf-8", errors="replace") as f:
            source_lines = f.readlines()
        line_text = source_lines[def_line - 1] if def_line <= len(source_lines) else ""
        remainder = line_text[def_col:]
        if remainder.startswith("async def "):
            def_col += 10
        elif remainder.startswith("def "):
            def_col += 4
        else:
            # Fallback search for def <old_name> on this line
            idx = line_text.find(old_name)
            if idx != -1:
                def_col = idx
    except IOError as e:
        return {"ok": False, "error": f"Failed reading source file: {e}"}

    substitutions: list[dict[str, Any]] = [
        _make_substitution(
            file_path=file_path,
            line=def_line,
            col=def_col,
            old_text=old_name,
            new_text=new_name,
            context="definition",
        )
    ]

    # Collect resolved incoming call sites
    for src, _, edge_data in graph.in_edges(target_node_id, data=True):
        if edge_data.get("type") not in ("calls", "instantiates"):
            continue

        call_file = edge_data.get("file")
        call_line = edge_data.get("line")
        call_col = edge_data.get("col")

        if call_file and call_line is not None and call_col is not None:
            resolved_file = os.path.abspath(call_file)
            substitutions.append(
                _make_substitution(
                    file_path=resolved_file,
                    line=call_line,
                    col=call_col,
                    old_text=old_name,
                    new_text=new_name,
                    context=f"call from {src}",
                )
            )

    # De-duplicate identical locations
    seen_locations: set[tuple[str, int, int]] = set()
    unique_subs: list[dict[str, Any]] = []
    files_affected: set[str] = set()

    for sub in substitutions:
        key = (sub["file"], sub["line"], sub["col"])
        if key not in seen_locations:
            seen_locations.add(key)
            unique_subs.append(sub)
            files_affected.add(sub["file"])

    return {
        "ok": True,
        "node_id": target_node_id,
        "old_name": old_name,
        "new_name": new_name,
        "substitutions": unique_subs,
        "files_affected": sorted(list(files_affected)),
    }


def verify_plan(plan: dict[str, Any]) -> dict[str, Any]:
    """Verify that each planned substitution matches the expected old text in the actual file."""
    if not plan.get("ok"):
        return plan

    failures: list[dict[str, Any]] = []
    for sub in plan.get("substitutions", []):
        file_path = sub["file"]
        line_num = sub["line"]
        col = sub["col"]
        expected = sub["old_text"]

        try:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()

            if line_num > len(lines) or line_num < 1:
                failures.append({
                    "file": file_path,
                    "line": line_num,
                    "col": col,
                    "expected": expected,
                    "found": f"<line {line_num} out of bounds>",
                })
                continue

            line_text = lines[line_num - 1]
            actual = line_text[col:col + len(expected)]
            if actual != expected:
                failures.append({
                    "file": file_path,
                    "line": line_num,
                    "col": col,
                    "expected": expected,
                    "found": actual,
                })
        except IOError as e:
            failures.append({
                "file": file_path,
                "line": line_num,
                "col": col,
                "expected": expected,
                "error": str(e),
            })

    if failures:
        return {
            "ok": False,
            "error": "Plan verification failed: file content does not match expected offsets.",
            "failures": failures,
        }

    return {"ok": True}


def apply_rename(plan: dict[str, Any]) -> dict[str, Any]:
    """Apply verified rename substitutions atomically to disk per file."""
    if not plan.get("ok"):
        return {"success": False, "error": plan.get("error", "Invalid plan"), "files_modified": []}

    by_file: dict[str, list[dict[str, Any]]] = {}
    for sub in plan.get("substitutions", []):
        by_file.setdefault(sub["file"], []).append(sub)

    prepared_contents: dict[str, str] = {}

    for file_path, subs in by_file.items():
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except IOError as e:
            return {"success": False, "error": f"Unable to read '{file_path}': {e}", "files_modified": []}

        # Apply substitutions bottom-to-top to keep column offsets consistent
        sorted_subs = sorted(subs, key=lambda s: (s["line"], s["col"]), reverse=True)

        for sub in sorted_subs:
            line_idx = sub["line"] - 1
            col = sub["col"]
            old_text = sub["old_text"]
            new_text = sub["new_text"]

            if line_idx >= len(lines):
                return {
                    "success": False,
                    "error": f"Line index {sub['line']} out of bounds in '{file_path}'",
                    "files_modified": [],
                }

            line = lines[line_idx]
            if line[col:col + len(old_text)] != old_text:
                return {
                    "success": False,
                    "error": f"Mismatch at {file_path}:{sub['line']}:{col}. Expected '{old_text}'.",
                    "files_modified": [],
                }

            lines[line_idx] = line[:col] + new_text + line[col + len(old_text):]

        prepared_contents[file_path] = "".join(lines)

    # All files prepared successfully; write to disk
    modified: list[str] = []
    for file_path, content in prepared_contents.items():
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            modified.append(file_path)
        except IOError as e:
            return {
                "success": False,
                "error": f"Failed writing to '{file_path}': {e}",
                "files_modified": modified,
            }

    return {"success": True, "files_modified": modified}
