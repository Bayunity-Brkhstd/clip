const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');

let mainWindow = null;
let backendProcess = null;
const BACKEND_PORT = process.env.PORT || 8000;
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch (e) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch (_) {}
  }
}

function checkBackendHealth(port, maxWaitMs = 15000) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        if (res.statusCode === 200) {
          clearInterval(interval);
          resolve(true);
        }
      });
      req.on('error', () => {
        if (Date.now() - startTime > maxWaitMs) {
          clearInterval(interval);
          resolve(false);
        }
      });
      req.setTimeout(800, () => req.destroy());
    }, 400);
  });
}

function waitForUrl(targetUrl, maxWaitMs = 15000) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      try {
        const u = new URL(targetUrl);
        const req = http.get({
          hostname: u.hostname,
          port: u.port || 80,
          path: u.pathname || '/',
          timeout: 800
        }, (res) => {
          if (res.statusCode < 500) {
            clearInterval(interval);
            resolve(true);
          }
        });
        req.on('error', () => {
          if (Date.now() - startTime > maxWaitMs) {
            clearInterval(interval);
            resolve(false);
          }
        });
        req.setTimeout(800, () => req.destroy());
      } catch (err) {
        clearInterval(interval);
        resolve(false);
      }
    }, 400);
  });
}

function findBackendExecutable() {
  const possiblePaths = [
    // Production: packaged in resources/backend
    path.join(process.resourcesPath, 'backend', 'cheat-clip-backend', 'cheat-clip-backend.exe'),
    path.join(process.resourcesPath, 'backend', 'cheat-clip-backend.exe'),
    path.join(process.resourcesPath, 'cheat-clip-backend', 'cheat-clip-backend.exe'),
    // Local build directory
    path.join(__dirname, '..', 'dist_backend', 'cheat-clip-backend', 'cheat-clip-backend.exe'),
    path.join(__dirname, '..', 'dist_backend', 'cheat-clip-backend.exe'),
  ];

  for (const p of possiblePaths) {
    try {
      if (require('fs').existsSync(p)) {
        return p;
      }
    } catch (_) {}
  }
  return null;
}

async function startBackend() {
  if (isDev) {
    // In dev mode, wait for backend server launched concurrently
    console.log(`[Electron] Connecting to backend server on port ${BACKEND_PORT}...`);
    const ready = await checkBackendHealth(BACKEND_PORT, 8000);
    if (!ready) {
      console.log('[Electron] Backend not active yet, spawning fallback Python process...');
      const pythonExe = process.platform === 'win32'
        ? path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe')
        : path.join(__dirname, '..', 'venv', 'bin', 'python');
      const pyToUse = require('fs').existsSync(pythonExe) ? pythonExe : 'python';

      backendProcess = spawn(pyToUse, ['-m', 'uvicorn', 'backend.main:app', '--port', String(BACKEND_PORT)], {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        detached: false
      });
      return await checkBackendHealth(BACKEND_PORT, 15000);
    }
    return true;
  } else {
    // Production mode: run bundled standalone backend executable
    const exePath = findBackendExecutable();
    if (!exePath) {
      console.error('[Electron] Backend executable not found! Attempting python fallback...');
      return false;
    }
    console.log(`[Electron] Launching backend binary: ${exePath}`);
    backendProcess = spawn(exePath, ['--port', String(BACKEND_PORT)], {
      cwd: path.dirname(exePath),
      stdio: 'pipe',
      detached: false
    });
  }

  if (backendProcess) {
    backendProcess.stdout.on('data', (d) => console.log(`[Backend] ${d.toString().trim()}`));
    backendProcess.stderr.on('data', (d) => console.error(`[Backend ERR] ${d.toString().trim()}`));
    backendProcess.on('exit', (code) => console.log(`[Backend] exited with code ${code}`));
  }

  return await checkBackendHealth(BACKEND_PORT, 20000);
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Cheat Clip PRO — AI Auto Clipper',
    backgroundColor: '#070a13',
    icon: path.join(__dirname, '..', 'public', 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      backgroundThrottling: false,
    },
    autoHideMenuBar: true,
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle native file downloads cleanly (MP4 clips & ZIP batches)
  mainWindow.webContents.session.on('will-download', (event, item, webContents) => {
    const filename = item.getFilename();
    const downloadsFolder = app.getPath('downloads');
    let savePath = path.join(downloadsFolder, filename);
    let counter = 1;
    const ext = path.extname(filename);
    const base = path.basename(filename, ext);
    while (require('fs').existsSync(savePath)) {
      savePath = path.join(downloadsFolder, `${base} (${counter})${ext}`);
      counter++;
    }

    item.setSavePath(savePath);

    item.once('done', (event, state) => {
      if (state === 'completed') {
        console.log(`[Electron] Download completed: ${savePath}`);
        try {
          shell.showItemInFolder(savePath);
        } catch (_) {}
      } else {
        console.warn(`[Electron] Download ended with state: ${state}`);
      }
    });
  });

  // Open external links (YouTube, Google Drive, documentation) in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const isLocal = url.startsWith(`http://127.0.0.1:${BACKEND_PORT}`) ||
                    url.startsWith(`http://localhost:${BACKEND_PORT}`) ||
                    url.startsWith('http://localhost:5173') ||
                    url.startsWith('blob:') ||
                    url.startsWith('data:');
    if (!isLocal && (url.startsWith('http:') || url.startsWith('https:'))) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isLocal = url.startsWith(`http://127.0.0.1:${BACKEND_PORT}`) || url.startsWith('http://localhost:5173');
    if (!isLocal) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (isDev) {
    console.log('[Electron] Waiting for Vite dev server (http://localhost:5173)...');
    await waitForUrl('http://localhost:5173', 15000);
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${BACKEND_PORT}/`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const ready = await startBackend();
  if (!ready) {
    console.warn('[Electron] Backend health check timed out. Launching window anyway...');
  }
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function cleanup() {
  if (backendProcess && backendProcess.pid) {
    console.log('[Electron] Shutting down backend process...');
    killProcessTree(backendProcess.pid);
    backendProcess = null;
  }
}

app.on('before-quit', cleanup);
app.on('will-quit', cleanup);
app.on('window-all-closed', () => {
  cleanup();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
