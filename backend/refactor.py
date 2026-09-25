"""
refactor.py — Safe, offset-based function rename refactoring.

Safety contract:
  1. Only renames call sites that were RESOLVED to the target node
     (ambiguous and unresolved call sites are never touched).
  2. Uses exact (file, line, col) offsets from the parser — NOT a regex find-and-replace.
  3. Verifies that the text at each planned location actually contains the old name
     before writing anything (if any check fails, the entire rename is aborted).
  4. Writes changes atomically per file: all substitutions for a file are applied
     in a single read-modify-write. Files are only written after ALL checks pass.
  5. Receiver-aware: does not rename attribute calls on non-self receivers
     (consistent with graph_builder.py's resolution filter).
"""

import os


# ---------------------------------------------------------------------------
# Planning phase — returns a substitution plan, writes nothing
# ---------------------------------------------------------------------------

def plan_rename(
    parsed: dict,
    graph,           # nx.DiGraph
    target_node_id: str,
    new_name: str,
) -> dict:
    """
    Build a substitution plan for renaming the function identified by target_node_id.

    Returns:
        {
          "ok": True,
          "old_name": str,
          "new_name": str,
          "substitutions": [
              { "file": abs_path, "line": int, "col": int,
                "old_text": str, "new_text": str, "context": str }
          ]
        }
    or:
        { "ok": False, "error": str }
    """
    if target_node_id not in graph.nodes:
        return {"ok": False, "error": f"Node '{target_node_id}' not found in graph."}

    node_data = graph.nodes[target_node_id]
    if node_data.get("kind") != "function":
        return {"ok": False, "error": "Only function nodes can be renamed."}

    old_name = node_data["name"]

    if not _is_valid_identifier(new_name):
        return {"ok": False, "error": f"'{new_name}' is not a valid Python identifier."}

    if new_name == old_name:
        return {"ok": False, "error": "New name is the same as the current name."}

    substitutions = []

    # 1. The function definition itself
    #    AST col_offset for FunctionDef points to the 'def' keyword.
    #    The function name starts after 'def ' (4 chars) or 'async def ' (10 chars).
    #    We need to check which one is in the file to set the right offset.
    def_col = node_data["col"]
    def_line = node_data["line"]
    try:
        with open(node_data["file"], "r", encoding="utf-8") as _f:
            _lines = _f.readlines()
        _line_text = _lines[def_line - 1] if def_line <= len(_lines) else ""
        # Check for 'async def ' vs 'def '
        stripped = _line_text[def_col:]
        if stripped.startswith("async def "):
            def_col += 10  # len("async def ")
        elif stripped.startswith("def "):
            def_col += 4   # len("def ")
    except IOError:
        def_col += 4  # assume plain 'def ' as fallback

    def_sub = _make_substitution(
        file=node_data["file"],
        line=node_data["line"],
        col=def_col,
        old_text=old_name,
        new_text=new_name,
        context="definition",
    )
    substitutions.append(def_sub)

    # 2. All RESOLVED call sites that point to this node
    #    Walk graph edges that land on target_node_id
    for src, tgt, edge_data in graph.in_edges(target_node_id, data=True):
        if edge_data.get("type") not in ("calls", "instantiates"):
            continue
        # Find the corresponding call record in parsed["calls"]
        call_file = edge_data.get("file")
        call_line = edge_data.get("line")
        call_col = edge_data.get("col")

        if call_file and call_line is not None:
            sub = _make_substitution(
                file=call_file,
                line=call_line,
                col=call_col,
                old_text=old_name,
                new_text=new_name,
                context=f"call from {src}",
            )
            substitutions.append(sub)

    # De-duplicate (same location might appear from multiple traversal paths)
    seen = set()
    unique_subs = []
    for s in substitutions:
        key = (s["file"], s["line"], s["col"])
        if key not in seen:
            seen.add(key)
            unique_subs.append(s)

    return {
        "ok": True,
        "old_name": old_name,
        "new_name": new_name,
        "substitutions": unique_subs,
    }


# ---------------------------------------------------------------------------
# Verification phase — checks offsets against actual file content
# ---------------------------------------------------------------------------

def verify_plan(plan: dict) -> dict:
    """
    Read each file and verify that the text at each planned (line, col)
    actually contains old_text. Returns a dict with ok=True if all checks
    pass, or ok=False with details of which checks failed.
    """
    if not plan.get("ok"):
        return plan

    failures = []
    for sub in plan["substitutions"]:
        file = sub["file"]
        line = sub["line"]
        col = sub["col"]
        old_text = sub["old_text"]

        try:
            with open(file, "r", encoding="utf-8") as f:
                lines = f.readlines()
            # lines is 0-indexed; line numbers from AST are 1-indexed
            line_content = lines[line - 1]
            actual = line_content[col: col + len(old_text)]
            if actual != old_text:
                failures.append({
                    "file": file,
                    "line": line,
                    "col": col,
                    "expected": old_text,
                    "found": actual,
                })
        except (IOError, IndexError) as e:
            failures.append({"file": file, "line": line, "col": col, "error": str(e)})

    if failures:
        return {
            "ok": False,
            "error": "Offset verification failed — file content does not match expected text.",
            "failures": failures,
        }
    return {"ok": True}


# ---------------------------------------------------------------------------
# Apply phase — writes changes atomically per file
# ---------------------------------------------------------------------------

def apply_rename(plan: dict) -> dict:
    """
    Apply a verified substitution plan to disk.

    Reads each affected file once, applies ALL substitutions for that file
    (processed in reverse line order to preserve offsets for earlier lines),
    then writes back. No file is written until all in-memory substitutions
    for that file have been successfully prepared.

    Returns:
        { "success": True, "files_modified": [abs_path, ...] }
    or:
        { "success": False, "error": str, "files_modified": [] }
    """
    if not plan.get("ok"):
        return {"success": False, "error": plan.get("error", "Invalid plan."), "files_modified": []}

    # Group substitutions by file
    by_file: dict[str, list[dict]] = {}
    for sub in plan["substitutions"]:
        by_file.setdefault(sub["file"], []).append(sub)

    new_contents: dict[str, str] = {}

    for filepath, subs in by_file.items():
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except IOError as e:
            return {
                "success": False,
                "error": f"Could not read {filepath}: {e}",
                "files_modified": [],
            }

        # Process substitutions in reverse line order (bottom to top) so
        # earlier line indices aren't shifted by earlier edits.
        subs_sorted = sorted(subs, key=lambda s: (s["line"], s["col"]), reverse=True)

        for sub in subs_sorted:
            line_idx = sub["line"] - 1   # convert 1-indexed to 0-indexed
            col = sub["col"]
            old_text = sub["old_text"]
            new_text = sub["new_text"]

            if line_idx >= len(lines):
                return {
                    "success": False,
                    "error": f"Line {sub['line']} out of range in {filepath}",
                    "files_modified": [],
                }

            line = lines[line_idx]
            # Final safety check
            if line[col: col + len(old_text)] != old_text:
                return {
                    "success": False,
                    "error": (
                        f"Safety check failed at {filepath}:{sub['line']}:{col} — "
                        f"expected '{old_text}', found '{line[col: col + len(old_text)]}'"
                    ),
                    "files_modified": [],
                }

            lines[line_idx] = line[:col] + new_text + line[col + len(old_text):]

        new_contents[filepath] = "".join(lines)

    # All preparations succeeded — now write to disk
    files_modified = []
    for filepath, content in new_contents.items():
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            files_modified.append(filepath)
        except IOError as e:
            return {
                "success": False,
                "error": f"Could not write {filepath}: {e}",
                "files_modified": files_modified,  # partial — some files may already be written
            }

    return {"success": True, "files_modified": files_modified}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _is_valid_identifier(name: str) -> bool:
    """Check that name is a valid Python identifier and not a keyword."""
    import keyword
    return name.isidentifier() and not keyword.iskeyword(name)


def _make_substitution(
    file: str,
    line: int,
    col: int,
    old_text: str,
    new_text: str,
    context: str,
) -> dict:
    """Read one line of context around the substitution for display in the UI."""
    display_context = ""
    try:
        with open(file, "r", encoding="utf-8") as f:
            lines = f.readlines()
        display_context = lines[line - 1].rstrip() if line <= len(lines) else ""
    except IOError:
        pass

    return {
        "file": file,
        "filename": os.path.basename(file),
        "line": line,
        "col": col,
        "old_text": old_text,
        "new_text": new_text,
        "context": context,
        "display_line": display_context,
    }
