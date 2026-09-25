"""
graph_builder.py — Converts parsed facts into a NetworkX directed graph.

Resolution strategy (in priority order for each call site):
  1. Class index match  → "instantiates" edge  (constructor call like Foo())
  2. Function index, 1 match → "calls" edge    (resolved call)
  3. Function index, >1 match → "ambiguous"    (do NOT guess)
  4. No match → "unresolved"                   (builtins, external libs, etc.)

Receiver-aware fix:
  Attribute calls (obj.method()) are only resolved if the receiver is "self"
  or absent (plain calls). Calls where the receiver is a different identifier
  (e.g. sqlite3.connect, cursor.execute) are marked unresolved rather than
  being matched by bare method name alone — this eliminates the false
  self-referencing edge discovered in Milestone 4.
"""

import os
import networkx as nx
from typing import Optional

try:
    from backend.parser import parse_project
except ImportError:
    from parser import parse_project


# ---------------------------------------------------------------------------
# Node ID construction
# ---------------------------------------------------------------------------

def _make_node_id(file: str, class_owner: Optional[str], name: str) -> str:
    """
    Build a unique node ID from file, optional class owner, and name.
    Format: "filename_without_ext::ClassName::name" or "filename::name"
    Uses the basename (without .py) to keep IDs readable.
    """
    base = os.path.splitext(os.path.basename(file))[0]
    if class_owner:
        return f"{base}::{class_owner}::{name}"
    return f"{base}::{name}"


def _make_class_node_id(file: str, name: str) -> str:
    base = os.path.splitext(os.path.basename(file))[0]
    return f"{base}::{name}"


# ---------------------------------------------------------------------------
# Core graph builder
# ---------------------------------------------------------------------------

def build_graph(parsed: dict) -> dict:
    """
    Build a NetworkX DiGraph from parser output.

    Returns:
        {
          "graph": nx.DiGraph,
          "resolved": int,
          "ambiguous": list[dict],
          "unresolved": list[dict],
          "nodes": list[dict],      # serialisable node list
          "edges": list[dict],      # serialisable edge list
        }
    """
    graph = nx.DiGraph()

    # ------------------------------------------------------------------
    # 1. Add all function nodes
    # ------------------------------------------------------------------
    for fn in parsed["functions"]:
        node_id = _make_node_id(fn["file"], fn["class_owner"], fn["name"])
        graph.add_node(
            node_id,
            kind="function",
            name=fn["name"],
            file=fn["file"],
            filename=fn.get("filename", os.path.basename(fn["file"])),
            line=fn["line"],
            col=fn["col"],
            class_owner=fn["class_owner"],
            args=fn["args"],
        )

    # ------------------------------------------------------------------
    # 2. Add all class nodes
    # ------------------------------------------------------------------
    for cls in parsed["classes"]:
        node_id = _make_class_node_id(cls["file"], cls["name"])
        graph.add_node(
            node_id,
            kind="class",
            name=cls["name"],
            file=cls["file"],
            filename=cls.get("filename", os.path.basename(cls["file"])),
            line=cls["line"],
            col=cls["col"],
            bases=cls["bases"],
        )

    # ------------------------------------------------------------------
    # 3. Build lookup indexes
    # ------------------------------------------------------------------

    # class_index: name → list of node IDs (handles same-name classes in different files)
    class_index: dict[str, list[str]] = {}
    for node_id, data in graph.nodes(data=True):
        if data["kind"] == "class":
            class_index.setdefault(data["name"], []).append(node_id)

    # func_index: name → list of node IDs
    func_index: dict[str, list[str]] = {}
    for node_id, data in graph.nodes(data=True):
        if data["kind"] == "function":
            func_index.setdefault(data["name"], []).append(node_id)

    # ------------------------------------------------------------------
    # 4. Add inheritance edges
    # ------------------------------------------------------------------
    for cls in parsed["classes"]:
        src_id = _make_class_node_id(cls["file"], cls["name"])
        for base_name in cls["bases"]:
            # Only resolve bases that exist in the project (skip Exception, object, etc.)
            if base_name in class_index:
                for target_id in class_index[base_name]:
                    graph.add_edge(src_id, target_id, type="inherits")

    # ------------------------------------------------------------------
    # 5. Resolve call sites → edges
    # ------------------------------------------------------------------
    resolved_count = 0
    ambiguous: list[dict] = []
    unresolved: list[dict] = []

    for call in parsed["calls"]:
        callee = call["callee_name"]
        receiver = call.get("receiver")  # None, "self", "cls", or some other identifier

        # --- Receiver-aware filter ---
        # If the call is an attribute access (receiver is not None),
        # only attempt resolution when the receiver is self/cls.
        # Any other receiver (e.g. sqlite3, cursor, conn) means the call
        # is almost certainly on an external object — mark unresolved.
        is_attribute_call = receiver is not None
        is_self_call = receiver in (None, "self", "cls")

        if is_attribute_call and not is_self_call:
            unresolved.append({**call, "reason": "external_receiver"})
            continue

        # Build the caller node ID so we can attach the edge
        caller_id: Optional[str] = None
        if call["caller_function"]:
            # caller_function is stored as "ClassName.method_name" or "function_name"
            parts = call["caller_function"].split(".", 1)
            if len(parts) == 2:
                class_part, func_part = parts
                caller_id = _make_node_id(call["file"], class_part, func_part)
            else:
                caller_id = _make_node_id(call["file"], None, parts[0])

        if caller_id is None or caller_id not in graph:
            unresolved.append({**call, "reason": "caller_not_found"})
            continue

        # --- Resolution priority 1: class names (constructor calls) ---
        if callee in class_index:
            for target_id in class_index[callee]:
                graph.add_edge(
                    caller_id, target_id,
                    type="instantiates",
                    file=call["file"],
                    line=call["line"],
                    col=call["col"],
                )
            resolved_count += 1
            continue

        # --- Resolution priority 2: function names ---
        if callee in func_index:
            matches = func_index[callee]
            if len(matches) == 1:
                graph.add_edge(
                    caller_id, matches[0],
                    type="calls",
                    file=call["file"],
                    line=call["line"],
                    col=call["col"],
                )
                resolved_count += 1
            else:
                # Multiple definitions with the same name — do NOT guess
                ambiguous.append({**call, "candidates": matches})
            continue

        # --- Unresolved (builtins, stdlib, external packages) ---
        unresolved.append({**call, "reason": "no_match"})

    # ------------------------------------------------------------------
    # 6. Serialisable summaries
    # ------------------------------------------------------------------
    nodes_out = [
        {"id": n, **{k: v for k, v in d.items()}}
        for n, d in graph.nodes(data=True)
    ]
    edges_out = [
        {"source": u, "target": v, **{k: v2 for k, v2 in d.items()}}
        for u, v, d in graph.edges(data=True)
    ]

    return {
        "graph": graph,
        "resolved": resolved_count,
        "ambiguous": ambiguous,
        "unresolved": unresolved,
        "nodes": nodes_out,
        "edges": edges_out,
    }


def build_graph_from_path(project_path: str) -> dict:
    """Convenience: parse a project path, then build the graph."""
    parsed = parse_project(project_path)
    result = build_graph(parsed)
    result["parsed"] = parsed   # kept so refactor.py can access raw call locations
    return result


# ---------------------------------------------------------------------------
# Quick self-test when run directly
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys
    import json

    target = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(__file__), "..", "sample_project"
    )
    target = os.path.abspath(target)
    print(f"Building graph for: {target}\n")

    result = build_graph_from_path(target)
    print(f"Nodes     : {len(result['nodes'])}")
    print(f"Edges     : {len(result['edges'])}")
    print(f"Resolved  : {result['resolved']}")
    print(f"Ambiguous : {len(result['ambiguous'])}")
    print(f"Unresolved: {len(result['unresolved'])}")
    print()

    print("=== NODES ===")
    for n in result["nodes"]:
        print(f"  [{n['kind']:8}] {n['id']}  ({n['filename']}:{n['line']})")

    print("\n=== EDGES ===")
    for e in result["edges"]:
        print(f"  {e['source']}  --[{e['type']}]-->  {e['target']}")

    print("\n=== AMBIGUOUS ===")
    for a in result["ambiguous"]:
        print(f"  {a['callee_name']} at {a['filename']}:{a['line']}  candidates={a['candidates']}")

    print("\n=== UNRESOLVED ===")
    for u in result["unresolved"]:
        print(f"  {u['callee_name']} at {u['filename']}:{u['line']}  reason={u['reason']}")
