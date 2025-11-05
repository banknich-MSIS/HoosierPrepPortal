# -*- mode: python ; coding: utf-8 -*-
# PyInstaller spec file for StudyTool backend

import os
import sys

block_cipher = None

a = Analysis(
    ['main.py'],
    pathex=[os.path.abspath('.')],
    binaries=[],
    datas=[
        # Don't include database - it will be created at runtime
    ],
    hiddenimports=[
        'fastapi',
        'fastapi.applications',
        'fastapi.routing',
        'fastapi.middleware',
        'fastapi.middleware.cors',
        'uvicorn',
        'uvicorn.lifespan.on',
        'uvicorn.lifespan.off',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.loops.auto',
        'sqlalchemy',
        'aiosqlite',
        'pydantic',
        'pandas',
        'pandas._libs.tslibs.timedeltas',
        'keybert',
        'yake',
        'google.generativeai',
        'PyPDF2',
        'docx',
        'pptx',
        'PIL',
        'python_multipart',
        'aiofiles',
        # Local module imports - use absolute imports
        'routes.files',
        'routes.concepts',
        'routes.exam',
        'routes.dashboard',
        'routes.classes',
        'routes.ai_generation',
        'services.csv_parser',
        'services.text_ingest',
        'services.concepts',
        'services.question_gen',
        'services.file_processor',
        'services.gemini_service',
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
    name='studytool-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,  # Set to False for production (no console window)
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

