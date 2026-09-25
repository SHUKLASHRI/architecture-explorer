"""
analyzer.py — Architecture analysis operations on a NetworkX DiGraph.

Three analyses:
  1. find_circular_dependencies — cycles in call/instantiates edges
  2. find_dead_functions        — functions with no incoming call edges
  3. impact_analysis            — callers and callees of a given node
"""

import networkx as nx


def find_circular_dependencies(graph: nx.DiGraph) -> list[list[str]]:
    """
    Find all simple cycles in the call graph (call + instantiates edges only;
    inheritance is not a runtime dependency and is excluded).

    Returns a list of cycles; each cycle is a list of node IDs forming the loop.
    An empty list means no circular dependencies were found.
    """
    # Build a subgraph containing only call-type edges
    call_graph = nx.DiGraph()
    call_graph.add_nodes_from(graph.nodes())
    for u, v, data in graph.edges(data=True):
        if data.get("type") in ("calls", "instantiates"):
            call_graph.add_edge(u, v)

    cycles = list(nx.simple_cycles(call_graph))
    # Sort for deterministic output
    return [sorted(cycle) for cycle in cycles]


def find_dead_functions(graph: nx.DiGraph) -> list[dict]:
    """
    Find functions that are never called within the project.

    Exclusions to reduce false positives:
    - Dunder methods (__init__, __str__, etc.) — implicitly called by Python
    - Methods of classes that ARE instantiated (if the class is reachable,
      its methods are reachable via the instance, even without explicit calls)
    - Common entry point names: main, run, app, start, setup

    Note: conservative, best-effort static analysis. Functions called via
    dynamic dispatch or from external callers may still be flagged.

    Returns a list of node attribute dicts for each dead function.
    """
    import os as _os

    # Classes that have been directly instantiated (incoming 'instantiates' edge)
    instantiated_classes: set[str] = set()
    for u, v, data in graph.edges(data=True):
        if data.get("type") == "instantiates":
            instantiated_classes.add(v)

    dead = []
    for node_id, data in graph.nodes(data=True):
        if data.get("kind") != "function":
            continue

        name = data.get("name", "")
        class_owner = data.get("class_owner")

        # Skip dunder methods — called implicitly by Python
        if name.startswith("__") and name.endswith("__"):
            continue

        # Skip common entry point names
        if name in ("main", "run", "app", "start", "init", "setup"):
            continue

        # Skip methods of instantiated classes — all methods are reachable
        # if the class itself is reachable via instantiation
        if class_owner:
            filename_base = _os.path.splitext(
                _os.path.basename(data.get("file", ""))
            )[0]
            class_node_id = f"{filename_base}::{class_owner}"
            if class_node_id in instantiated_classes:
                continue

        incoming = [
            (u, v, d)
            for u, v, d in graph.in_edges(node_id, data=True)
            if d.get("type") in ("calls", "instantiates")
        ]
        if not incoming:
            dead.append({"id": node_id, **data})
    return dead



def impact_analysis(graph: nx.DiGraph, node_id: str) -> dict:
    """
    For a given node, find:
      - callers:  all nodes that (directly or transitively) call this node
      - callees:  all nodes that this node (directly or transitively) calls

    Uses nx.ancestors (upstream) and nx.descendants (downstream).
    Only traverses call/instantiates edges; ignores inheritance.

    Returns:
        {
          "node": node_id,
          "callers": [node_id, ...],
          "callees": [node_id, ...],
          "direct_callers": [node_id, ...],
          "direct_callees": [node_id, ...],
        }
    """
    if node_id not in graph:
        return {
            "node": node_id,
            "error": "node not found",
            "callers": [],
            "callees": [],
            "direct_callers": [],
            "direct_callees": [],
        }

    # Build call-only subgraph for traversal
    call_graph = nx.DiGraph()
    call_graph.add_nodes_from(graph.nodes())
    for u, v, data in graph.edges(data=True):
        if data.get("type") in ("calls", "instantiates"):
            call_graph.add_edge(u, v)

    callers = list(nx.ancestors(call_graph, node_id))
    callees = list(nx.descendants(call_graph, node_id))

    direct_callers = [
        u for u, v, d in call_graph.in_edges(node_id, data=True)
    ]
    direct_callees = [
        v for u, v, d in call_graph.out_edges(node_id, data=True)
    ]

    return {
        "node": node_id,
        "callers": callers,
        "callees": callees,
        "direct_callers": direct_callers,
        "direct_callees": direct_callees,
    }
