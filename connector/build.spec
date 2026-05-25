# connector/build.spec
# PyInstaller spec for PortfolioConnector.exe
# Run from connector/ directory: pyinstaller build.spec --clean
# Requires: pip install pyinstaller pystray pillow httpx
# Output: connector/dist/PortfolioConnector.exe  (~40-60 MB)

import sys
from pathlib import Path

block_cipher = None

# Locate moomoo-service and assets relative to this spec file
ROOT = Path(SPECPATH).parent
MOOMOO_SERVICE_DIR = ROOT / "moomoo-service"
ASSETS_DIR = Path(SPECPATH) / "assets"

a = Analysis(
    [str(Path(SPECPATH) / "main.py")],
    pathex=[str(ROOT), str(MOOMOO_SERVICE_DIR)],  # include moomoo-service for dep analysis
    binaries=[],
    datas=[
        # Bundle entire moomoo-service directory (main.py loaded at runtime via importlib)
        (str(MOOMOO_SERVICE_DIR), "moomoo-service"),
        # Bundle icon assets
        (str(ASSETS_DIR / "icon_green.png"),  "connector/assets"),
        (str(ASSETS_DIR / "icon_yellow.png"), "connector/assets"),
        (str(ASSETS_DIR / "icon_red.png"),    "connector/assets"),
    ],
    hiddenimports=[
        # pystray pitfall — PyInstaller misses the Windows backend
        "pystray._win32",
        "PIL._tkinter_finder",
        "tkinter",
        "tkinter.ttk",
        # uvicorn — runs moomoo-service in-process
        "uvicorn",
        "uvicorn.lifespan.on",
        "uvicorn.loops.auto",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.websockets.auto",
        # FastAPI / moomoo-service dependencies
        "fastapi",
        "fastapi.middleware.cors",
        "pydantic",
        "pydantic.deprecated.class_validators",
        "dotenv",
        # moomoo SDK — imported lazily in moomoo-service route handlers
        "moomoo",
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
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
    name="PortfolioConnector",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,          # No terminal window — system tray app only
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(ASSETS_DIR / "icon_green.png"),
)
