"""Architecture analysis operations on NetworkX dependency graphs.

Provides:
  1. find_circular_dependencies: simple cycles among call/instantiation edges.
  2. find_dead_functions: functions with no incoming call/instantiation edges.
  3. impact_analysis: transitive callers and callees for a given node.
"""

from __future__ import annotations

import os
import re
from typing import Any
import networkx as nx

ENTRYPOINT_NAMES = frozenset({"main", "run", "app", "start", "init", "setup", "cli"})
FRAMEWORK_DECORATOR_PATTERN = re.compile(
    r"@(app|router|bp|blueprint|pytest|fixture|property|validator|classmethod|staticmethod)",
    re.IGNORECASE,
)


def find_circular_dependencies(graph: nx.DiGraph) -> list[list[str]]:
    """Find all simple cycles among calls and instantiations in the graph."""
    call_subgraph = nx.DiGraph()
    call_subgraph.add_nodes_from(graph.nodes())
    for u, v, data in graph.edges(data=True):
        if data.get("type") in ("calls", "instantiates"):
            call_subgraph.add_edge(u, v)

    try:
        cycles = list(nx.simple_cycles(call_subgraph))
        return [sorted(cycle) for cycle in cycles]
    except Exception:
        return []


def find_dead_functions(graph: nx.DiGraph) -> list[dict[str, Any]]:
    """Identify functions that have no incoming call or instantiation edges.

    Filters out:
      - Dunder methods (__init__, __str__, etc.)
      - Common entrypoint names (main, run, app, etc.)
      - Framework/test-decorated functions (FastAPI, Flask, pytest, properties)
      - Methods of classes that are instantiated
    """
    instantiated_classes: set[str] = {
        v for _, v, data in graph.edges(data=True) if data.get("type") == "instantiates"
    }

    dead: list[dict[str, Any]] = []

    for node_id, data in graph.nodes(data=True):
        if data.get("kind") not in ("function", "async_function", "method"):
            continue

        name = data.get("name", "")
        if name.startswith("__") and name.endswith("__"):
            continue
        if name in ENTRYPOINT_NAMES:
            continue

        decorators = data.get("decorators", [])
        if any(FRAMEWORK_DECORATOR_PATTERN.search(d) for d in decorators):
            continue

        class_owner = data.get("class_owner")
        if class_owner:
            module = data.get("module", "")
            class_id = f"{module}::{class_owner}" if module else None
            filename_base = os.path.splitext(os.path.basename(data.get("file", "")))[0]
            legacy_class_id = f"{filename_base}::{class_owner}"
            if (class_id and class_id in instantiated_classes) or (legacy_class_id in instantiated_classes):
                continue

        incoming_calls = [
            u for u, _, edge in graph.in_edges(node_id, data=True)
            if edge.get("type") in ("calls", "instantiates")
        ]
        if not incoming_calls:
            dead.append({
                "id": node_id,
                "name": name,
                "file": data.get("file", ""),
                "filename": data.get("filename", os.path.basename(data.get("file", ""))),
                "line": data.get("line", 1),
                "cyclomatic_complexity": data.get("cyclomatic_complexity", 1),
                **{k: v for k, v in data.items() if k not in ("id", "name", "file", "filename", "line", "cyclomatic_complexity")},
            })

    return dead


def impact_analysis(graph: nx.DiGraph, node_id: str) -> dict[str, Any]:
    """Find direct and transitive callers and callees for a given node."""
    if node_id not in graph:
        return {
            "node": node_id,
            "error": f"Node '{node_id}' not found in graph",
            "callers": [],
            "callees": [],
            "direct_callers": [],
            "direct_callees": [],
        }

    call_subgraph = nx.DiGraph()
    call_subgraph.add_nodes_from(graph.nodes())
    for u, v, data in graph.edges(data=True):
        if data.get("type") in ("calls", "instantiates"):
            call_subgraph.add_edge(u, v)

    callers = sorted(list(nx.ancestors(call_subgraph, node_id)))
    callees = sorted(list(nx.descendants(call_subgraph, node_id)))
    direct_callers = sorted([u for u, _, _ in call_subgraph.in_edges(node_id, data=True)])
    direct_callees = sorted([v for _, v, _ in call_subgraph.out_edges(node_id, data=True)])

    return {
        "node": node_id,
        "callers": callers,
        "callees": callees,
        "direct_callers": direct_callers,
        "direct_callees": direct_callees,
    }
