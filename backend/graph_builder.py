"""Legacy graph builder compatibility module.

Delegates project scanning to ProjectArchitectureMapper to avoid duplicate AST parsing
while preserving the build_graph_from_path interface.
"""

from __future__ import annotations

import os
from typing import Any
import networkx as nx

from backend.project_mapper import ProjectArchitectureMapper


def build_graph_from_path(path: str) -> dict[str, Any]:
    """Scan directory and return graph and summary metrics."""
    mapper = ProjectArchitectureMapper(path)
    res = mapper.generate_project_map()
    return {
        "graph": res["graph"],
        "nodes": res["nodes"],
        "edges": res["edges"],
        "resolved": res["summary"]["resolved_calls"],
        "unresolved": res["summary"]["unresolved_calls"],
        "ambiguous": res["summary"].get("ambiguous_count", 0),
        "parsed": {"files_parsed": res["summary"]["total_files"]},
        "summary": res["summary"],
    }
