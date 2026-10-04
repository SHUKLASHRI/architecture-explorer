# Irminsul IDE — Python Architecture & Refactor Workbench

[![Website](https://img.shields.io/badge/Live_Website-shuklashri.github.io%2Farchitecture--explorer-007acc?style=for-the-badge&logo=google-chrome&logoColor=white)](https://shuklashri.github.io/architecture-explorer/)
[![Author: Shrinath Shukla](https://img.shields.io/badge/Author-Shrinath%20Shukla-007acc?style=for-the-badge&logo=github)](https://github.com/SHUKLASHRI)
[![Release](https://img.shields.io/badge/Release-v1.0.0-cca700.svg?style=for-the-badge)](https://github.com/SHUKLASHRI/architecture-explorer/releases)

🌐 **Official Website**: [https://shuklashri.github.io/architecture-explorer/](https://shuklashri.github.io/architecture-explorer/)

Irminsul IDE is a desktop-grade architecture visualization and refactoring workbench for Python codebases. It performs deep, AST-based static analysis to map modules, symbols, call graphs, coupling metrics, and cyclomatic complexity into an interactive, infinite canvas with floating HUD panels.

![Irminsul IDE](https://raw.githubusercontent.com/SHUKLASHRI/architecture-explorer/main/frontend/screenshot.png)

---

## Features

- **Production-Grade AST Mapping Algorithm**:
  - Scans any local Python project recursively without executing code.
  - Extracts classes, sync/async functions, full typed signatures, parameter default values, return annotations, decorators, and docstrings.
  - Computes exact McCabe Cyclomatic Complexity per function from AST branching structures (If, While, For, AsyncFor, ExceptHandler, With, BoolOp, Comprehensions).
- **Import-Aware Call Graph**:
  - Resolves calls using module import alias maps (`from x import y as z`), direct imports, relative imports, and class inheritance hierarchies.
- **Architectural Tiers & Diagnostics**:
  - Categorizes code into 5 architectural tiers: `presentation`, `services`, `persistence`, `utilities`, and `core`.
  - Calculates module coupling metrics: Afferent Coupling ($C_a$), Efferent Coupling ($C_e$), and Instability Index ($I = C_e / (C_a + C_e)$).
  - Detects circular dependency cycles, dead (unreferenced) functions, and complexity hotspots.
- **Desktop-Grade Interactive UI**:
  - Full-screen infinite canvas with click-and-drag panning, smooth mouse wheel zooming, and draggable nodes with real-time Bézier curve cables.
  - Floating HUD panels with **Hover-Peek** (unfolds on hover, auto-minimizes when cursor leaves) and **Click-to-Pin** (locks open; re-click to fold).
  - Integrated syntax-highlighted code viewer with line-level navigation.
  - Safe AST-offset function rename refactoring (F2) with verification and atomic write safety.
- **Cross-Platform & Portable**:
  - Zero hardcoded machine paths. Automatically resolves project directories dynamically on Windows, macOS, and Linux.
  - Can be run as a local web app or packaged as a standalone desktop executable via PyWebView and PyInstaller.

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+ (for modifying the React frontend; pre-built bundle is already included)

### 1. Installation
Clone the repository and install the Python dependencies:

```bash
git clone https://github.com/SHUKLASHRI/architecture-explorer.git
cd architecture-explorer
pip install -r requirements.txt
```

### 2. Run as Web Application
Start the local Flask server:

```bash
python app.py
```
Then navigate to `http://localhost:5173` in your browser.

### 3. Run as Native Desktop App
Launch with PyWebView desktop window:

```bash
python main.py
```

### 4. Build / Modify the React Frontend (Optional)
If you wish to modify the React frontend:

```bash
cd frontend-react
npm install
npm run build
```
This builds the production static assets directly into `../frontend/`, which are immediately served by Flask or PyWebView.

---

## Architecture

- **`backend/project_mapper.py`**: The multi-pass AST analysis engine that scans projects, computes McCabe complexity, resolves imports, and generates unified architecture maps.
- **`backend/graph_builder.py`**: Constructs directed dependency graphs (`networkx.DiGraph`).
- **`backend/analyzer.py`**: Graph algorithms for circular dependency detection (`simple_cycles`), dead function discovery, and impact analysis.
- **`backend/refactor.py`**: AST-offset based rename planning and verification.
- **`app.py`**: Local Flask REST API server.
- **`frontend-react/`**: React 19 + TypeScript + Vite frontend with Tailwind CSS and Prism.js.
- **`sample_project/`**: Included sample Python project for immediate testing.

---

## Author & Ownership

Created, developed, and owned by **Shrinath Shukla** ([@SHUKLASHRI](https://github.com/SHUKLASHRI)). All rights reserved.

