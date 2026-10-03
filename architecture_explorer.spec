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

import sys

icon_file = 'icon.ico' if sys.platform == 'win32' else None

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
    upx=(sys.platform == 'win32'),
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,   # no console window
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=icon_file,
)

if sys.platform == 'darwin':
    app = BUNDLE(
        exe,
        name='IrminsulIDE.app',
        icon=None,
        bundle_identifier='io.irminsul.ide',
        info_plist={
            'CFBundleName': 'Irminsul IDE',
            'CFBundleDisplayName': 'Irminsul IDE',
            'CFBundleIdentifier': 'io.irminsul.ide',
            'CFBundleVersion': '1.0.0',
            'CFBundlePackageType': 'APPL',
            'CFBundleShortVersionString': '1.0.0',
            'NSHighResolutionCapable': 'True',
        },
    )

