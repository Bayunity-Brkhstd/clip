# 🤖 Cheat Clip PRO — AGENTS.md

> **AI & Contributor Instruction Manual**  
> *Panduan Arsitektur, Aturan Pengembangan, dan Instruksi Sistem untuk Asisten AI (Antigravity, Cursor, Copilot, Claude, dll.) dan Kontributor Proyek.*

---

## 📌 1. Project Overview & Architecture

**Cheat Clip PRO** is an AI-powered automated video clipping platform designed to convert long-form videos (YouTube, Google Drive, direct video uploads) into vertical short-form content (TikTok, Shorts, Reels) with:
- AI-driven viral timestamp & hook detection using Google's official Gemini 3 models (`gemini-3.8-flash`, `gemini-3.5-flash-lite`, `gemini-3.7-flash`).
- Dynamic karaoke subtitles (ASS/SRT with LibASS, animated word-by-word highlight).
- Face detection & smart tracking (OpenCV Haar Cascade + YuNet ONNX) for 9:16 vertical / 1:1 square crop.
- Hardware-accelerated video rendering via FFmpeg (NVENC, AMF, QSV, libx264).
- Dual-target distribution:
  1. **Web App**: Vite + React 19 + Vanilla CSS frontend + FastAPI backend.
  2. **Native Desktop (.exe)**: Electron wrapper + PyInstaller standalone backend bundle + Inno/NSIS installer.

---

## 📂 2. Repository Structure

```
cheat-clip-pro/
├── AGENTS.md                       # This instructions file
├── README.md                       # User documentation & setup guide
├── build-desktop.bat               # Windows batch script for one-click desktop build
├── package.json                    # Node.js dependencies, electron-builder config & scripts
├── vite.config.ts                  # Vite build & dev configuration
├── cheat-clip-backend.spec         # PyInstaller spec for standalone Python backend
├── electron/
│   ├── main.cjs                    # Electron main process (spawns backend, window lifecycle, download handler)
│   └── preload.cjs                 # Electron preload bridge
├── src/                            # Frontend (React 19 + TypeScript)
│   ├── App.tsx                     # Top-level application state & layout orchestrator
│   ├── index.css                   # Global design tokens, typography, dark mode CSS
│   ├── components/                 # UI components
│   │   ├── Header.tsx              # Navbar, branding, system status, API Key modal trigger
│   │   ├── VideoInputSection.tsx   # URL inputs (YouTube/Drive) & drag-and-drop file upload
│   │   ├── SettingsSection.tsx     # Clip duration, Gemini model selector, target platform
│   │   ├── ClipStudioSection.tsx   # Clip management, batch rendering CTA, export controls
│   │   ├── ClipCard.tsx            # Individual clip preview, viral score badge, edit modal
│   │   ├── SubtitleSettings.tsx    # Subtitle styling, font presets, uppercase toggle
│   │   └── ApiKeyModal.tsx         # Multi-key rotator input & validation
│   ├── types/                      # TypeScript definitions (Clip, Settings, RenderJob, etc.)
│   └── utils/                      # Helper utilities (time formatters, storage, network)
├── backend/                        # Backend (FastAPI + Python 3.10-3.14)
│   ├── main.py                     # FastAPI entrypoint + PyInstaller yt-dlp CLI interceptor
│   ├── video_engine.py             # FFmpeg wrapper, face detection, subtitle burn, hardware accel
│   ├── requirements.txt            # Python dependencies (fastapi, uvicorn, yt-dlp, whisper, opencv)
│   ├── routers/
│   │   ├── analyze.py              # Video transcript extraction & Gemini analysis endpoints
│   │   ├── render.py               # Render job dispatch, status polling, stream output
│   │   └── download.py             # Clip MP4 & ZIP archive download endpoints
│   ├── services/
│   │   ├── key_rotator.py          # Multi-key load balancing & 503 fallback logic
│   │   └── download_service.py     # yt-dlp downloader & video metadata extractor
│   ├── cascades/                   # Face detection models (face_detection_yunet.onnx, etc.)
│   ├── fonts/                      # Bundled viral font families (.ttf / .otf)
│   └── haarcascade_frontalface_default.xml # OpenCV default frontal face model
├── dist/                           # Built frontend production assets (Vite)
├── dist_backend/                   # Built standalone backend executable (PyInstaller)
└── dist_installer/                 # Packaged desktop application (win-unpacked & Setup .exe)
```

---

## ⚠️ 3. Critical Rules for AI Agents & Contributors

### Rule 1: PyInstaller Frozen Mode Compatibility (Backend)
- When packaged with PyInstaller, `sys.frozen == True` and `sys.executable` points to `cheat-clip-backend.exe` (NOT `python.exe`).
- **NEVER** run commands like `[sys.executable, "-m", "yt_dlp", ...]` without ensuring `backend/main.py` has an interceptor at the very top of the script. If `main.py` does not intercept `-m yt_dlp`, it will spawn a second instance of the FastAPI server instead of executing yt-dlp, causing the rendering subprocess to hang indefinitely!
- Always resolve bundled resources (fonts, XML cascades, ONNX models) using `_resolve_resource_path()` or `getattr(sys, '_MEIPASS', ...)` to accommodate both development and frozen directory structures (`_internal/...`).

### Rule 2: Subtitle & AI Dependencies in PyInstaller Spec
- In `cheat-clip-backend.spec`:
  - **DO NOT** put `'unittest'` in `excludes`. Whisper AI and PyTorch internally require Python's built-in `unittest` module. Excluding it breaks subtitle transcription (`No module named 'unittest'`).
  - Always ensure `datas` includes:
    - `('backend/fonts', 'backend/fonts')` and `('backend/fonts', 'fonts')`
    - `('backend/haarcascade_frontalface_default.xml', '.')`
    - `('backend/cascades', 'backend/cascades')`
  - Ensure `hidden_imports` includes `'whisper'`, `'torch'`, `'scipy'`, `'cv2'`, `'yt_dlp'`.

### Rule 3: FFmpeg & yt-dlp Detection in Windows
- Windows machines frequently have FFmpeg or yt-dlp installed in non-standard locations (such as WinGet user directories `AppData\Local\Microsoft\WinGet\Packages\...` or chocolatey).
- `backend/video_engine.py` must use `ensure_ffmpeg_in_path()` to scan `candidate_roots` and prepend them to `os.environ["PATH"]`.
- When invoking `yt-dlp`, always pass `--ffmpeg-location <path_to_ffmpeg>` so yt-dlp uses the detected FFmpeg binary for audio extraction and post-processing.
- Burning subtitles via FFmpeg requires `libass` support (`subtitles: True`). Ensure Gyan or full FFmpeg build is utilized.

### Rule 4: Frontend UI State & Clip Selection
- In `src/App.tsx`:
  - When AI analysis finishes (`result` is updated), **always auto-select all analyzed clips** (`markedClips[clip.id] = true`) if no previous selection exists.
  - If `markedClips` is left empty `{}`, the Render button in `ClipStudioSection.tsx` becomes disabled (`selectedClips.length === 0`), confusing users into thinking the application is stuck.

### Rule 5: Electron Desktop Download Handling
- In `electron/main.cjs`:
  - Electron windows do not automatically save files when clicking `<a download>` links.
  - An explicit `session.defaultSession.on('will-download', (event, item, webContents) => ...)` listener must be maintained to:
    1. Resolve unique filenames without overwriting existing files in the user's `Downloads` folder.
    2. Promptly notify the user or reveal the file in Windows File Explorer via `shell.showItemInFolder(...)`.
  - Ensure `setWindowOpenHandler` allows local requests (`localhost`, `127.0.0.1`) to stay inside the app rather than booting them to an external browser.

### Rule 6: Styling System (Vanilla CSS Only)
- **DO NOT** install or use TailwindCSS unless explicitly instructed by the user.
- Maintain consistency with the design system in `src/index.css` (custom HSL color tokens, dark glassmorphism, micro-animations, Inter/Outfit typography).

---

## 🛠️ 4. Build & Development Commands

| Command | Description | Output / Target |
| :--- | :--- | :--- |
| `npm run dev` | Runs both Vite frontend (`:5173`) and FastAPI backend (`:8000`) concurrently | Browser dev mode |
| `npm run electron:dev` | Runs dev servers and opens the native Electron desktop window | Hot-reloading desktop dev |
| `npm run build` | Compiles TypeScript and builds production frontend bundle | `dist/` |
| `npm run electron:build:backend` | Bundles FastAPI backend into standalone executable using PyInstaller | `dist_backend/cheat-clip-backend/` |
| `npm run electron:pack` | Packages Electron app without building full setup installer | `dist_installer/win-unpacked/Cheat Clip PRO.exe` |
| `npm run electron:dist` | Generates full NSIS Windows installer setup wizard | `dist_installer/Cheat Clip PRO Setup 1.0.0.exe` |
| `npm run build:desktop` | Runs full automated pipeline (frontend -> backend -> installer) | Complete release build |

---

## 🧪 5. Verification Checklist for Changes

Before finalizing code changes, an AI agent or contributor should verify:

1. **Frontend Compilation**:
   ```bash
   npm run build
   ```
   *Must exit with code 0 and zero TypeScript errors.*

2. **Backend Syntax Check**:
   ```bash
   python -m py_compile backend/main.py backend/video_engine.py backend/routers/*.py backend/services/*.py
   ```
   *Must compile cleanly with no syntax errors.*

3. **FFmpeg & Whisper Compatibility**:
   - Verify that FFmpeg contains libass (`ffmpeg -version` shows `--enable-libass`).
   - Verify that Whisper model loads without `ModuleNotFoundError`.

4. **Desktop Packaging (if modifying backend/electron)**:
   - Ensure `npm run electron:build:backend` succeeds.
   - Verify `dist_installer/win-unpacked/Cheat Clip PRO.exe` can launch and communicate with `dist_installer/win-unpacked/resources/backend/cheat-clip-backend/cheat-clip-backend.exe`.
   - Verify that downloading rendered clips writes files to the OS Downloads directory.

---

## 🤝 6. Contributing Guidelines

- **Atomic Commits**: Group related changes (e.g. backend rendering fixes vs UI styling) into clear, documented commits.
- **Do Not Break Web/Docker**: Always maintain backward compatibility between the standalone Electron desktop mode and the standard web browser mode.
- **Preserve Comments**: Do not remove existing comments or architectural notes in code files unless refactoring the underlying logic.
- **Language**: User communications should be clear, respectful, and default to Indonesian if the user queries in Indonesian.
