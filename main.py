"""
main.py — Desktop entry point for Irminsul IDE.

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

def find_available_port(preferred_port: int = 5173) -> int:
    """Find an available TCP port starting from preferred_port."""
    import socket
    for p in range(preferred_port, preferred_port + 30):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', p))
                return p
        except OSError:
            continue
    return preferred_port


PORT = find_available_port(5173)
_flask_ready = threading.Event()


def _run_flask():
    """Run Flask in a background daemon thread."""
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
        print(f"ERROR: Flask server did not start on port {PORT} in time.", file=sys.stderr)
        sys.exit(1)

    print(f"Irminsul IDE → http://127.0.0.1:{PORT}")

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
        title="Irminsul IDE",
        url=f"http://127.0.0.1:{PORT}",
        width=1440,
        height=900,
        resizable=True,
        min_size=(960, 640),
        background_color="#1e1e1e",
        js_api=api,
    )

    icon_path = resource_path("icon.ico")
    icon_arg = icon_path if os.path.isfile(icon_path) else None

    # On Windows, register AppUserModelID for crisp taskbar and window icon
    try:
        import ctypes
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID("shuklashri.irminsulide.1.0")
    except Exception:
        pass

    def apply_native_icon():
        if os.name != 'nt' or not icon_arg:
            return
        try:
            import ctypes
            import time
            time.sleep(0.1)
            WM_SETICON = 0x0080
            ICON_SMALL = 0
            ICON_BIG = 1
            LR_LOADFROMFILE = 0x00000010
            IMAGE_ICON = 1

            hwnd = None
            if hasattr(window, 'native') and window.native:
                try:
                    hwnd = int(window.native.Handle.ToInt64())
                except Exception:
                    pass
            if not hwnd:
                hwnd = ctypes.windll.user32.FindWindowW(None, "Irminsul IDE")

            if hwnd:
                h_small = ctypes.windll.user32.LoadImageW(None, icon_arg, IMAGE_ICON, 16, 16, LR_LOADFROMFILE)
                h_big = ctypes.windll.user32.LoadImageW(None, icon_arg, IMAGE_ICON, 32, 32, LR_LOADFROMFILE)
                if h_small:
                    ctypes.windll.user32.SendMessageW(hwnd, WM_SETICON, ICON_SMALL, h_small)
                if h_big:
                    ctypes.windll.user32.SendMessageW(hwnd, WM_SETICON, ICON_BIG, h_big)
        except Exception:
            pass

    window.events.shown += apply_native_icon

    try:
        # Prefer modern Edge Chromium engine on Windows for maximum 120 FPS performance
        webview.start(apply_native_icon, gui='edgechromium', debug=False, icon=icon_arg)
    except Exception:
        webview.start(apply_native_icon, debug=False, icon=icon_arg)

