"""Release builder script for Irminsul IDE.

Builds:
1. Production frontend React bundle (npm run build)
2. Standalone Windows Desktop Executable (PyInstaller)
3. Packaged ZIP distribution in dist/
"""

import os
import shutil
import subprocess
import sys
import zipfile

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
DIST_DIR = os.path.join(ROOT_DIR, "dist")
WEBSITE_DIR = os.path.join(ROOT_DIR, "website")


def log(msg: str):
    print(f"\n[Irminsul Builder] {msg}")


def build_frontend():
    log("Building frontend bundle...")
    frontend_react = os.path.join(ROOT_DIR, "frontend-react")
    res = subprocess.run("npm run build", shell=True, cwd=frontend_react)
    if res.returncode != 0:
        log("ERROR: Frontend build failed.")
        sys.exit(1)
    log("Frontend bundle built successfully.")


def build_executable():
    log("Packaging IrminsulIDE with PyInstaller...")
    spec_file = os.path.join(ROOT_DIR, "architecture_explorer.spec")
    res = subprocess.run(f"pyinstaller --noconfirm {spec_file}", shell=True, cwd=ROOT_DIR)
    if res.returncode != 0:
        log("ERROR: PyInstaller build failed.")
        sys.exit(1)
    
    exe_path = os.path.join(DIST_DIR, "IrminsulIDE.exe")
    if os.path.isfile(exe_path):
        size_mb = os.path.getsize(exe_path) / (1024 * 1024)
        log(f"Executable built successfully: {exe_path} ({size_mb:.1f} MB)")
    else:
        log("Warning: Executable not found in dist/.")


def create_release_zip():
    log("Creating release ZIP archive...")
    exe_path = os.path.join(DIST_DIR, "IrminsulIDE.exe")
    if not os.path.isfile(exe_path):
        log("Skipping zip: IrminsulIDE.exe not found.")
        return

    zip_path = os.path.join(DIST_DIR, "IrminsulIDE-v1.0.0-Windows-x64.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(exe_path, arcname="IrminsulIDE.exe")
        readme = os.path.join(ROOT_DIR, "README.md")
        if os.path.isfile(readme):
            zf.write(readme, arcname="README.md")

    zip_size = os.path.getsize(zip_path) / (1024 * 1024)
    log(f"Release ZIP created: {zip_path} ({zip_size:.1f} MB)")


def prepare_website():
    log("Syncing website assets...")
    shutil.copyfile(os.path.join(ROOT_DIR, "logo.svg"), os.path.join(WEBSITE_DIR, "logo.svg"))
    shutil.copyfile(os.path.join(ROOT_DIR, "icon.ico"), os.path.join(WEBSITE_DIR, "favicon.ico"))
    log("Website assets ready in website/ directory.")


if __name__ == "__main__":
    log("=== Starting Irminsul IDE Release Packaging ===")
    prepare_website()
    build_frontend()
    # Note: run PyInstaller if pyinstaller is installed
    try:
        import PyInstaller
        build_executable()
        create_release_zip()
    except ImportError:
        log("PyInstaller not found in environment. To build binary .exe, run: pip install pyinstaller")
    log("=== Release Packaging Complete ===")
