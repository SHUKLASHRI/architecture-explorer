"""
parser.py — AST-based static analysis of Python source files.

Extracts raw architectural facts from every .py file in a project:
  - Function and method definitions (with file, line, column, owning class, args)
  - Class definitions (with file, line, base class names)
  - Import statements (module, names, file, line)
  - Call sites (callee name, receiver, enclosing function/class, file, line, col)

Deliberately keeps parsing and resolution as separate concerns:
raw facts are collected here; resolving which definition a call refers to
is handled by graph_builder.py.
"""

import ast
import os
from typing import Optional


class FileVisitor(ast.NodeVisitor):
    """Visits the AST of a single Python source file and collects facts."""

    def __init__(self, filepath: str):
        self.filepath = filepath
        # Use a short relative-friendly name for display; full path kept separately
        self.filename = os.path.basename(filepath)

        self.functions: list[dict] = []
        self.classes: list[dict] = []
        self.imports: list[dict] = []
        self.calls: list[dict] = []

        # Internal traversal state
        self._class_stack: list[str] = []      # supports nested classes
        self._function_stack: list[str] = []   # supports nested functions

    # ------------------------------------------------------------------
    # Class definitions
    # ------------------------------------------------------------------

    def visit_ClassDef(self, node: ast.ClassDef):
        bases = []
        for base in node.bases:
            if isinstance(base, ast.Name):
                bases.append(base.id)
            elif isinstance(base, ast.Attribute):
                bases.append(f"{ast.unparse(base)}")

        self.classes.append({
            "name": node.name,
            "file": self.filepath,
            "filename": self.filename,
            "line": node.lineno,
            "col": node.col_offset,
            "bases": bases,
        })

        self._class_stack.append(node.name)
        self.generic_visit(node)
        self._class_stack.pop()

    # ------------------------------------------------------------------
    # Function / method definitions
    # ------------------------------------------------------------------

    def _visit_function(self, node):
        # Capture fixed positional args only (known limitation: *args/**kwargs excluded)
        args = [arg.arg for arg in node.args.args]

        class_owner = self._class_stack[-1] if self._class_stack else None

        self.functions.append({
            "name": node.name,
            "file": self.filepath,
            "filename": self.filename,
            "line": node.lineno,
            "col": node.col_offset,
            "class_owner": class_owner,
            "args": args,
        })

        # Push onto function stack so call sites can record their enclosing function
        qualified = f"{class_owner}.{node.name}" if class_owner else node.name
        self._function_stack.append(qualified)
        self.generic_visit(node)
        self._function_stack.pop()

    def visit_FunctionDef(self, node: ast.FunctionDef):
        self._visit_function(node)

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
        self._visit_function(node)

    # ------------------------------------------------------------------
    # Import statements
    # ------------------------------------------------------------------

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            self.imports.append({
                "module": alias.name,
                "names": [],          # bare import — no specific names
                "alias": alias.asname,
                "file": self.filepath,
                "filename": self.filename,
                "line": node.lineno,
                "kind": "import",
            })

    def visit_ImportFrom(self, node: ast.ImportFrom):
        names = [alias.name for alias in node.names]
        self.imports.append({
            "module": node.module or "",
            "names": names,
            "file": self.filepath,
            "filename": self.filename,
            "line": node.lineno,
            "kind": "from_import",
        })

    # ------------------------------------------------------------------
    # Call sites
    # ------------------------------------------------------------------

    def visit_Call(self, node: ast.Call):
        callee_name: Optional[str] = None
        receiver: Optional[str] = None   # identifier the call is made on, e.g. "sqlite3"

        func = node.func
        if isinstance(func, ast.Name):
            # Plain call: foo()
            callee_name = func.id
            receiver = None
        elif isinstance(func, ast.Attribute):
            # Attribute call: obj.method()
            callee_name = func.attr
            # Capture the receiver so graph_builder can check if it is "self"
            if isinstance(func.value, ast.Name):
                receiver = func.value.id
            else:
                # Complex receiver (e.g. chained calls) — record as opaque
                receiver = ast.unparse(func.value)

        if callee_name:
            enclosing_function = (
                self._function_stack[-1] if self._function_stack else None
            )
            enclosing_class = (
                self._class_stack[-1] if self._class_stack else None
            )
            self.calls.append({
                "callee_name": callee_name,
                "receiver": receiver,          # None for plain calls, "self" for self.x(), etc.
                "caller_function": enclosing_function,
                "caller_class": enclosing_class,
                "file": self.filepath,
                "filename": self.filename,
                "line": node.lineno,
                "col": node.col_offset,
            })

        # Always visit children (handles nested calls)
        self.generic_visit(node)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_file(filepath: str) -> dict:
    """Parse a single .py file and return its extracted facts."""
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        source = f.read()

    try:
        tree = ast.parse(source, filename=filepath)
    except SyntaxError as e:
        # Return an empty result rather than crashing on unparseable files
        return {
            "functions": [],
            "classes": [],
            "imports": [],
            "calls": [],
            "error": str(e),
            "file": filepath,
        }

    visitor = FileVisitor(filepath)
    visitor.visit(tree)

    return {
        "functions": visitor.functions,
        "classes": visitor.classes,
        "imports": visitor.imports,
        "calls": visitor.calls,
        "file": filepath,
    }


def parse_project(project_path: str) -> dict:
    """
    Walk every .py file under project_path and aggregate extracted facts.

    Returns:
        {
          "functions": [...],
          "classes": [...],
          "imports": [...],
          "calls": [...],
          "files_parsed": int,
          "parse_errors": [...]
        }
    """
    all_functions: list[dict] = []
    all_classes: list[dict] = []
    all_imports: list[dict] = []
    all_calls: list[dict] = []
    parse_errors: list[dict] = []
    files_parsed = 0

    for root, dirs, files in os.walk(project_path):
        # Skip hidden directories and common non-source dirs
        dirs[:] = [
            d for d in dirs
            if not d.startswith(".")
            and d not in ("__pycache__", ".venv", "venv", "node_modules", "dist", "build")
        ]

        for filename in files:
            if not filename.endswith(".py"):
                continue

            filepath = os.path.join(root, filename)
            result = parse_file(filepath)
            files_parsed += 1

            if "error" in result:
                parse_errors.append({"file": filepath, "error": result["error"]})
            else:
                all_functions.extend(result["functions"])
                all_classes.extend(result["classes"])
                all_imports.extend(result["imports"])
                all_calls.extend(result["calls"])

    return {
        "functions": all_functions,
        "classes": all_classes,
        "imports": all_imports,
        "calls": all_calls,
        "files_parsed": files_parsed,
        "parse_errors": parse_errors,
    }


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
    print(f"Parsing: {target}\n")

    result = parse_project(target)
    print(f"Files parsed  : {result['files_parsed']}")
    print(f"Functions     : {len(result['functions'])}")
    print(f"Classes       : {len(result['classes'])}")
    print(f"Imports       : {len(result['imports'])}")
    print(f"Call sites    : {len(result['calls'])}")
    if result["parse_errors"]:
        print(f"Parse errors  : {result['parse_errors']}")
    print()
    print(json.dumps(result, indent=2))
