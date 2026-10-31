# -*- mode: python ; coding: utf-8 -*-
import os
import sys
from pathlib import Path

block_cipher = None
project_root = os.path.abspath(os.getcwd())

datas = []
fonts_dir = os.path.join(project_root, 'backend', 'fonts')
if os.path.exists(fonts_dir):
    datas.append((fonts_dir, os.path.join('backend', 'fonts')))
cascade_file = os.path.join(project_root, 'backend', 'haarcascade_frontalface_default.xml')
if os.path.exists(cascade_file):
    datas.append((cascade_file, 'backend'))
    datas.append((cascade_file, '.'))
cascades_dir = os.path.join(project_root, 'backend', 'cascades')
if os.path.exists(cascades_dir):
    datas.append((cascades_dir, os.path.join('backend', 'cascades')))
    datas.append((cascades_dir, 'cascades'))
dist_folder = os.path.join(project_root, 'dist')
if os.path.exists(dist_folder):
    datas.append((dist_folder, 'dist'))

hidden_imports = [
    # Uvicorn internals
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.loops.asyncio',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    
    # FastAPI & Starlette
    'fastapi',
    'fastapi.staticfiles',
    'fastapi.responses',
    'fastapi.middleware.cors',
    'starlette',
    'starlette.routing',
    'starlette.responses',
    'starlette.staticfiles',
    
    # Pydantic & GenAI
    'pydantic',
    'pydantic_core',
    'google',
    'google.genai',
    'google.genai.types',
    'dotenv',
    'PIL',
    'PIL.Image',
    'PIL.ImageDraw',
    'PIL.ImageFont',
    
    # Media tools & AI transcription
    'yt_dlp',
    'whisper',
    'torch',
    'scipy',
    'cv2',
    
    # Internal modules
    'backend',
    'backend.config',
    'backend.security',
    'backend.video_engine',
    'backend.main',
    'backend.routers',
    'backend.routers.analyze',
    'backend.routers.cookies',
    'backend.routers.downloads',
    'backend.routers.media',
    'backend.routers.render',
    'backend.routers.system',
    'backend.services',
    'backend.services.ai_service',
    'backend.services.download_service',
    'backend.services.gdrive_service',
    'backend.services.openrouter_service',
    'backend.services.render_service',
    'backend.services.system_service',
    'backend.services.youtube_service',
    'backend.schemas',
    'backend.schemas.analyze',
    'backend.schemas.downloads',
    'backend.schemas.render',
    'backend.utils',
    'backend.utils.heatmap',
    'backend.utils.proxy',
    'backend.utils.sse',
    'backend.utils.text',
]

a = Analysis(
    [os.path.join(project_root, 'backend', 'main.py')],
    pathex=[project_root],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'test'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='cheat-clip-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='cheat-clip-backend',
)
