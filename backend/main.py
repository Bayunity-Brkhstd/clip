import sys

# Support executing yt-dlp CLI via the compiled executable (e.g. `cheat-clip-backend.exe -m yt_dlp ...`)
if len(sys.argv) > 1 and sys.argv[1] == "-m" and len(sys.argv) > 2 and sys.argv[2] in ("yt_dlp", "yt-dlp"):
    import yt_dlp
    sys.exit(yt_dlp.main(sys.argv[3:]))

import asyncio
from contextlib import asynccontextmanager
import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

# Initialize environment and configuration
import backend.config
from backend.config import logger
from backend.routers import (
    analyze_router,
    cookies_router,
    downloads_router,
    media_router,
    render_router,
    system_router,
)
# Re-exports for backwards compatibility
from backend.schemas.analyze import (
    AnalyzeRequest,
    AnalyzeResponse,
    HeatmapPoint,
    TranscriptLine,
    VideoAnalysis,
    ViralClip,
    ViralClipGemini,
)
from backend.schemas.downloads import (
    CookiesSaveRequest,
    RawClipDownloadRequest,
    RawVideoDownloadRequest,
)
from backend.schemas.render import (
    RenderBatchRequest,
    RenderSettingsModel,
    RetryBatchRequest,
)
from backend.services.download_service import (
    raw_clip_download_jobs,
    raw_download_jobs,
)
from backend.services.render_service import (
    BATCH_REQUESTS,
    RENDER_BATCHES,
)
from backend.services.system_service import auto_cleanup_expired_files


async def background_storage_cleanup_worker():
    """
    Background worker that runs every 30 minutes (configurable via CLEANUP_INTERVAL_SECONDS):
    1. Option 1: TTL cleanup (files older than 1 hour / TEMP_MAX_AGE_SECONDS).
    2. Option 2: 5GB Max Quota ceiling (FIFO purge oldest files down to 80% if quota exceeded).
    """
    # Initial pause on startup
    await asyncio.sleep(15)
    while True:
        try:
            ttl_seconds = int(os.environ.get("TEMP_MAX_AGE_SECONDS", "3600"))
            max_quota_gb = float(os.environ.get("TEMP_STORAGE_QUOTA_GB", "5.0"))
            max_quota_bytes = int(max_quota_gb * 1024 * 1024 * 1024)
            auto_cleanup_expired_files(max_age_seconds=ttl_seconds, max_storage_bytes=max_quota_bytes)
        except Exception as e:
            logger.warning(f"[Auto-Cleanup] Background worker encountered an error: {e}")

        interval_seconds = int(os.environ.get("CLEANUP_INTERVAL_SECONDS", "1800"))
        await asyncio.sleep(interval_seconds)


from backend.security import install_security_logging, mask_sensitive_text
from fastapi.responses import JSONResponse


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure all logger handlers (including Uvicorn) have the security masking filter attached
    install_security_logging()
    # Startup: spawn auto-cleanup background task
    cleanup_task = asyncio.create_task(background_storage_cleanup_worker())
    logger.info("[Auto-Cleanup] Storage daemon active (Interval: 30m, TTL: 1h, Quota: 5GB).")
    yield
    # Shutdown: cancel task cleanly
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


# Initialize FastAPI Application
app = FastAPI(
    title="CHEAT CLIP PRO API",
    description="High-performance backend API for Cheat Clip Pro auto-clipper and video studio",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration supporting configurable ALLOWED_ORIGINS and local development
allowed_origins_env = os.environ.get("ALLOWED_ORIGINS", "").strip()
if allowed_origins_env:
    allow_origins = [orig.strip() for orig in allowed_origins_env.split(",") if orig.strip()]
else:
    allow_origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=r"^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Adds standard security headers to all responses."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


@app.exception_handler(Exception)
async def sanitized_exception_handler(request: Request, exc: Exception):
    """Catches unhandled errors, logs a redacted error string, and returns a sanitized response."""
    safe_err = mask_sensitive_text(str(exc))
    logger.error(f"Internal server error on {request.method} {request.url.path}: {safe_err}")
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred. Please try again or check logs."}
    )


# Include Modular Routers
app.include_router(analyze_router)
app.include_router(render_router)
app.include_router(media_router)
app.include_router(cookies_router)
app.include_router(downloads_router)
app.include_router(system_router)

# Mount built frontend in production container if dist/ exists
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

if getattr(sys, "frozen", False):
    exe_dir = Path(sys.executable).parent
    meipass = Path(getattr(sys, "_MEIPASS", exe_dir))
    candidates = [
        meipass / "dist",
        exe_dir / "dist",
        exe_dir / "_internal" / "dist",
        exe_dir.parent / "dist",
        exe_dir.parent.parent / "dist",
        exe_dir.parent.parent.parent / "dist",
    ]
    dist_dir = next((c for c in candidates if c.exists() and (c / "index.html").exists()), exe_dir / "dist")
else:
    dist_dir = Path(__file__).resolve().parent.parent / "dist"

if dist_dir.exists() and (dist_dir / "index.html").exists():
    if (dist_dir / "assets").exists():
        app.mount("/assets", StaticFiles(directory=dist_dir / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_candidate = dist_dir / full_path
        if full_path and file_candidate.exists() and file_candidate.is_file():
            return FileResponse(file_candidate)
        response = FileResponse(dist_dir / "index.html")
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response
    
    logger.info(f"Cheat Clip PRO production frontend mounted from {dist_dir}.")
else:
    logger.info("Cheat Clip PRO backend routers mounted successfully.")

if __name__ == "__main__":
    import uvicorn
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    if getattr(sys, "frozen", False):
        uvicorn.run(app, host=host, port=port, reload=False)
    else:
        uvicorn.run("backend.main:app", host=host, port=port, reload=True)
