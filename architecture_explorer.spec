# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec for Irminsul IDE
# Build with: pyinstaller architecture_explorer.spec

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=[
        ('frontend', 'frontend'),             # Built frontend assets
        ('sample_project', 'sample_project'), # Bundled sample project
        ('backend', 'backend'),               # Python backend modules
        ('icon.ico', '.'),                    # Native Windows icon
        ('logo.svg', '.'),                    # Vector branding
    ],
    hiddenimports=[
        'networkx',
        'networkx.algorithms',
        'networkx.algorithms.cycles',
        'networkx.classes',
        'networkx.classes.digraph',
        'flask',
        'flask_cors',
        'webview',
        'webview.platforms',
        'engineio',
        'engineio.async_drivers',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'numpy', 'pandas'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='IrminsulIDE',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,   # no console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon='icon.ico',
)
