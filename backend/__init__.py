"""Backend package for Irminsul IDE."""

from backend.analyzer import find_circular_dependencies, find_dead_functions, impact_analysis
from backend.project_mapper import ProjectArchitectureMapper
from backend.project_service import ProjectService, service
from backend.refactor import apply_rename, plan_rename, verify_plan

__all__ = [
    "ProjectArchitectureMapper",
    "ProjectService",
    "service",
    "find_circular_dependencies",
    "find_dead_functions",
    "impact_analysis",
    "plan_rename",
    "verify_plan",
    "apply_rename",
]
