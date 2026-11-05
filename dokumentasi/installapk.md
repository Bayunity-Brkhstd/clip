# 🛠️ Panduan Lengkap Build Desktop Installer (.exe) — Cheat Clip PRO

Dokumen ini berisi panduan teknis langkah demi langkah (*step-by-step*) untuk membangun (*build*) paket **Standalone Desktop Installer Windows (`.exe` NSIS Setup Wizard)** Cheat Clip PRO dari kode sumber (*source code*).

Setelah proses build selesai, Anda akan mendapatkan satu file installer mandiri (misal: `Cheat Clip PRO Setup 1.1.0.exe`) yang siap didistribusikan kepada pengguna akhir tanpa memerlukan instalasi Node.js, Python, FFmpeg, atau Git manual di PC target.

---

## 📋 1. Kebutuhan Sistem & Prerequisites

Sebelum memulai proses kompilasi, pastikan sistem pengembang telah memenuhi spesifikasi berikut:

### A. Perangkat Keras (Hardware)
- **Sistem Operasi**: Windows 10 atau Windows 11 (64-bit Architecture).
- **RAM**: Minimal **8 GB** (Sangat disarankan **16 GB**, karena PyInstaller mem-bundle library AI berukuran masif seperti PyTorch, Whisper, dan OpenCV).
- **Ruang Penyimpanan (Disk)**: Minimal **10 GB ruang kosong** untuk menampung dependensi, cache kompilasi, dan file output binary.

### B. Perangkat Lunak (Software Wajib)
1. **Node.js**: Versi **v18.x**, **v20.x**, atau yang lebih baru (LTS).
   - Verifikasi di terminal:
     ```powershell
     node -v
     npm -v
     ```
2. **Python**: Versi **3.10 sampai 3.14 (64-bit)**.
   - *PENTING*: Saat instalasi Python di Windows, pastikan opsi **"Add Python to PATH"** dicentang.
   - Verifikasi di terminal:
     ```powershell
     python --version
     ```
3. **Git for Windows**:
   - Verifikasi di terminal:
     ```powershell
     git --version
     ```

---

## 🏗️ 2. Arsitektur Paket Installer Mandiri

Installer desktop Cheat Clip PRO dibangun dengan menggabungkan 3 lapisan teknologi:

```mermaid
flowchart TD
    subgraph S1["1. Frontend Compilation"]
        src_ui["React 19 + TypeScript + Vite<br/>[src/]"] -->|"npm run build"| dist_ui["Production SPA Bundle<br/>[dist/]"]
    end

    subgraph S2["2. Backend Binary Bundling"]
        src_py["FastAPI + PyTorch + Whisper + OpenCV<br/>[backend/]"] -->|"PyInstaller (.spec)"| dist_py["Standalone Python Executable<br/>[dist_backend/cheat-clip-backend/]"]
    end

    subgraph S3["3. Electron NSIS Packaging"]
        electron_core["Electron 44 Runtime + main.cjs"]
        dist_ui --> electron_core
        dist_py --> electron_core
        electron_core -->|"electron-builder"| installer_exe["Windows Installer Wizard<br/>[dist_installer/Cheat Clip PRO Setup 1.1.0.exe]"]
    end
```

---

## 🚀 3. Langkah Demi Langkah Eksekusi Build

### Langkah 1: Clone Repository & Buka Folder Project
Buka terminal (PowerShell atau Command Prompt) dan clone repository resmi:
```powershell
git clone https://github.com/Bayunity-Brkhstd/clip.git cheat-clip-pro
cd cheat-clip-pro
```

---

### Langkah 2: Instalasi Dependensi Frontend (Node.js)
Install seluruh library antarmuka pengguna:
```powershell
npm install
```
> [!NOTE]
> Dependensi utama mencakup React 19, Lucide React, MP4-Muxer, Vite, Electron, dan Electron-Builder.

---

### Langkah 3: Setup Virtual Environment & Dependensi Backend (Python)
Sangat disarankan menggunakan virtual environment tersendiri agar library tidak konflik dengan instalasi Python global:

1. **Buat Virtual Environment:**
   ```powershell
   python -m venv venv
   ```

2. **Aktifkan Virtual Environment:**
   - **PowerShell**:
     ```powershell
     .\venv\Scripts\Activate.ps1
     ```
     *(Jika muncul script execution policy error, jalankan: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` lalu ulangi).*
   - **Command Prompt (CMD)**:
     ```cmd
     venv\Scripts\activate.bat
     ```

3. **Upgrade Pip & Install Dependensi Backend:**
   ```powershell
   python -m pip install --upgrade pip
   pip install -r backend/requirements.txt
   ```

4. **Install PyInstaller:**
   ```powershell
   pip install pyinstaller>=6.10.0
   ```

---

### Langkah 4: Kompilasi Frontend ke Production Bundle (`dist/`)
Kompilasi kode TypeScript dan stylesheet Blue Neon menjadi aset web statis teroptimasi:
```powershell
npm run electron:build:frontend
```
*Atau setara dengan:*
```powershell
npm run build
```
✅ **Hasil**: Folder `dist/` tercipta berisi `index.html`, folder `assets/` (file JS, CSS ter-minify), serta icon SVG/ICO.

---

### Langkah 5: Kompilasi Backend Python via PyInstaller (`dist_backend/`)
Bundle seluruh engine FastAPI, model Whisper, cascade face-tracking OpenCV, dan font pack ke folder binary mandiri:
```powershell
python -m PyInstaller cheat-clip-backend.spec --distpath dist_backend --workpath build_pyinstaller -y
```
*Atau setara dengan:*
```powershell
npm run electron:build:backend
```

> [!IMPORTANT]
> Proses ini memakan waktu sekitar **2 hingga 5 menit** tergantung kecepatan CPU dan SSD Anda. PyInstaller akan memproses ribuan dependensi C++ / DLL dari PyTorch, Whisper, dan OpenCV.

✅ **Hasil Verifikasi**:
Pastikan file executable backend telah terbentuk di:
```powershell
Test-Path "dist_backend/cheat-clip-backend/cheat-clip-backend.exe"
# Harus bernilai True
```

---

### Langkah 6: Packaging NSIS Desktop Installer via Electron Builder
Gabungkan runtime Electron, bundle frontend di `dist/`, dan backend executable di `dist_backend/` menjadi installer wizard:
```powershell
npm run electron:dist
```

> [!NOTE]
> `electron-builder` akan:
> 1. Memaketkan kode UI dan Node runtime ke dalam `resources/app.asar`.
> 2. Menyalin `dist/` ke `resources/dist/`.
> 3. Menyalin binary backend ke `resources/backend/cheat-clip-backend/`.
> 4. Mengemas seluruhnya ke dalam NSIS Setup Installer `.exe`.

✅ **Hasil Akhir**:
File installer siap pakai akan terbentuk di folder `dist_installer/`:
- `dist_installer\Cheat Clip PRO Setup 1.1.0.exe` (Ukuran ~330 MB - 350 MB).

---

## ⚡ 4. Cara Cepat: One-Click Automated Build

Jika semua dependensi (Node.js & Python di virtual environment) sudah terpasang, Anda cukup menjalankan satu perintah otomatis yang mengeksekusi ketiga tahap di atas secara sekuensial:

### Opsi A: Melalui Script Batch Windows
Jalankan file batch yang sudah disediakan di root folder:
```powershell
.\build-desktop.bat
```

### Opsi B: Melalui NPM Script
```powershell
npm run build:desktop
```

---

## 🛡️ 5. Aturan Teknis Krusial (Guardrails Kompilasi)

Saat memodifikasi atau membangun installer ini, wajib mematuhi aturan arsitektur berikut (berdasarkan standar [`AGENTS.md`](./AGENTS.md)):

1. **Resolusi Path SPA di `backend/main.py` (`sys.frozen`)**:
   Dalam mode PyInstaller (`getattr(sys, "frozen", False)`), folder `dist` berada di `_internal/dist` atau `resources/dist`. Gunakan algoritma pencarian multi-kandidat:
   ```python
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
   ```

2. **Dilarang Menjalankan `reload=True` di PyInstaller**:
   Di dalam executable frozen, Uvicorn wajib dijalankan dengan `reload=False`:
   ```python
   if getattr(sys, "frozen", False):
       uvicorn.run(app, host=host, port=port, reload=False)
   else:
       uvicorn.run("backend.main:app", host=host, port=port, reload=True)
   ```

3. **Pembersihan Cache Chromium di `electron/main.cjs`**:
   Untuk mencegah Chromium me-load cache halaman lama pada saat upgrade versi, panggil pembersihan session cache saat startup:
   ```javascript
   await mainWindow.webContents.session.clearCache();
   ```

4. **Jangan Mengecualikan `unittest` di PyInstaller**:
   PyTorch dan Whisper membutuhkan modul internal `unittest`. Jangan pernah menambahkan `'unittest'` ke dalam list `excludes` pada `cheat-clip-backend.spec`.

5. **Pertahankan yt-dlp CLI Interceptor di Baris Teratas `main.py`**:
   Baris 1–6 di `backend/main.py` wajib mempertahankan interceptor `sys.argv[1:]` agar pemanggilan `yt-dlp` dari subprocess tidak memicu instansiasi server FastAPI ganda.

6. **Git Ignore untuk Folder Build**:
   Pastikan folder binary `build_pyinstaller/`, `dist_backend/`, dan `dist_installer/` tetap berada di dalam `.gitignore` agar tidak di-push ke GitHub (mencegah error batas ukuran file GitHub 100MB).

---

## ❓ 6. Troubleshooting & FAQ

### Q1: Tampilan UI di aplikasi setelah diinstal masih memunculkan tema lama / tombol lama?
**Solusi**:
1. Hapus cache lokal Chromium Electron di komputer pengguna:
   ```powershell
   Remove-Item -Path "$env:APPDATA\cheat-clip-pro\Cache" -Recurse -Force -ErrorAction SilentlyContinue
   Remove-Item -Path "$env:APPDATA\cheat-clip-pro\Code Cache" -Recurse -Force -ErrorAction SilentlyContinue
   Remove-Item -Path "$env:APPDATA\cheat-clip-pro\GPUCache" -Recurse -Force -ErrorAction SilentlyContinue
   ```
2. Pastikan Anda menjalankan `npm run build` dan `python -m PyInstaller ...` sebelum menjalankan `npm run electron:dist` agar bundle `dist` yang baru benar-benar masuk ke dalam installer.

### Q2: Error `ModuleNotFoundError` saat backend dijalankan?
**Solusi**:
Pastikan module yang hilang telah didaftarkan ke dalam array `hidden_imports` di [`cheat-clip-backend.spec`](file:///d:/berjan/cheat-clip-pro-master/cheat-clip-backend.spec), misalnya `'backend.services.key_rotator'`.

### Q3: Error `Port 8000 already in use` saat Electron membuka backend?
**Solusi**:
Tutup instansi Cheat Clip PRO atau proses uvicorn yang masih tertinggal di background:
```powershell
Get-Process -Name "*cheat*", "*uvicorn*" -ErrorAction SilentlyContinue | Stop-Process -Force
```

---

## 📦 7. Hasil Build yang Dihasilkan

Setelah semua langkah berhasil, file distribusi siap dibagikan kepada pengguna:

| Target File | Lokasi File | Deskripsi |
| :--- | :--- | :--- |
| **Windows NSIS Installer** | `dist_installer/Cheat Clip PRO Setup 1.1.0.exe` | Wizard installer resmi Windows (desktop & start menu shortcut) |
| **Unpacked Directory** | `dist_installer/win-unpacked/Cheat Clip PRO.exe` | Versi portable tanpa instalasi (untuk debugging cepat) |
| **Backend Standalone Binary** | `dist_backend/cheat-clip-backend/cheat-clip-backend.exe` | Server backend mandiri tanpa runtime Python terpisah |

