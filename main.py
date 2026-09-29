"""
main.py — Desktop entry point for Architecture Explorer.

Starts the Flask API in a background daemon thread, then opens a native
OS window via pywebview pointing at the local server. The user sees a
normal desktop application window — no browser chrome, no address bar.
"""

import threading
import time
import sys
import os

# When running as a PyInstaller bundle, resource paths need adjustment
def resource_path(relative: str) -> str:
    """Get absolute path to a resource — works for dev and PyInstaller .exe."""
    if hasattr(sys, '_MEIPASS'):
        base = sys._MEIPASS
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, relative)

# Ensure backend is importable
sys.path.insert(0, resource_path("."))

import webview
from app import app as flask_app

PORT = 5173
_flask_ready = threading.Event()


def _run_flask():
    """Run Flask in a background daemon thread."""
    # Suppress Flask's startup banner in the packaged app
    import logging
    log = logging.getLogger('werkzeug')
    log.setLevel(logging.ERROR)

    flask_app.run(
        host="127.0.0.1",
        port=PORT,
        debug=False,
        use_reloader=False,
    )


def _wait_for_flask(timeout=10.0):
    """Poll until Flask is accepting connections or timeout."""
    import socket
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", PORT), timeout=0.5):
                return True
        except OSError:
            time.sleep(0.1)
    return False


if __name__ == "__main__":
    # Start Flask
    flask_thread = threading.Thread(target=_run_flask, daemon=True)
    flask_thread.start()

    # Pre-warm AST cache concurrently so app opens instantaneously
    def _prewarm():
        try:
            from app import _get_result, _resolve_project_path
            p = _resolve_project_path("")
            _get_result(p)
        except Exception:
            pass

    threading.Thread(target=_prewarm, daemon=True).start()

    # Wait for it to be ready
    if not _wait_for_flask():
        print("ERROR: Flask server did not start in time.", file=sys.stderr)
        sys.exit(1)

    print(f"Architecture Explorer → http://localhost:{PORT}")

    class DesktopApi:
        def open_folder_dialog(self):
            """Open native OS folder chooser dialog and return path."""
            result = window.create_file_dialog(webview.FOLDER_DIALOG)
            if result and len(result) > 0:
                return result[0]
            return None

    api = DesktopApi()

    # Open native window (like Figma / VS Code desktop)
    window = webview.create_window(
        title="Architecture Explorer",
        url=f"http://localhost:{PORT}",
        width=1440,
        height=900,
        resizable=True,
        min_size=(960, 640),
        background_color="#1e1e1e",
        js_api=api,
    )

    webview.start(debug=False)
