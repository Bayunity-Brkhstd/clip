@echo off
setlocal enabledelayedexpansion
title Cheat Clip PRO - Desktop App Builder

echo =====================================================================
echo           CHALLENGE CLIP PRO - NATIVE DESKTOP BUILDER
echo =====================================================================
echo.
echo [1/4] Checking environment requirements...

where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found in PATH! Please install Node.js 18+.
    pause
    exit /b 1
)

where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is not found in PATH! Please install Python 3.10+.
    pause
    exit /b 1
)

python -c "import PyInstaller" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [INFO] PyInstaller not detected. Installing PyInstaller...
    python -m pip install pyinstaller
)

echo [OK] Node.js and Python environments verified.
echo.

echo =====================================================================
echo [2/4] Building React Production Web Frontend (Vite)...
echo =====================================================================
call npm run electron:build:frontend
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)
echo [OK] Frontend built successfully to dist/ folder.
echo.

echo =====================================================================
echo [3/4] Compiling Standalone Python Backend with PyInstaller...
echo =====================================================================
call npm run electron:build:backend
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Backend PyInstaller compilation failed!
    pause
    exit /b 1
)
echo [OK] Standalone backend compiled to dist_backend/ folder.
echo.

echo =====================================================================
echo [4/4] Packaging Electron Native Windows Installer (.exe)...
echo =====================================================================
call npm run electron:dist
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Electron packaging failed!
    pause
    exit /b 1
)

echo.
echo =====================================================================
echo                    BUILD SUCCESSFUL!
echo =====================================================================
echo.
echo Your native Windows installer has been created at:
echo   dist_installer\
echo.
echo You can run the Setup .exe file to install Cheat Clip PRO as a
echo standalone desktop application on any Windows machine!
echo.
pause
