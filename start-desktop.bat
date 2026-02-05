@echo off
echo ==========================================
echo   Network Inspector Desktop - Easy Start
echo ==========================================
echo.

:: Check if Rust is installed
rustc --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Rust is not installed or not in PATH
    echo [!] Please install Rust from: https://rustup.rs/
    echo [!] Or run: winget install Rustlang.Rustup
    echo.
    pause
    exit /b 1
)
echo [OK] Rust is installed

:: Check if Node.js is installed
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] Node.js is not installed or not in PATH
    echo [!] Please install Node.js from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js is installed

:: Check if running as administrator (for certificate installation)
net session >nul 2>&1
if %errorLevel% equ 0 (
    echo [OK] Running as Administrator
    echo.
    echo [Step 1/2] Installing CA Certificate...
    cd /d "%~dp0"
    certutil -addstore -f "ROOT" "certs\ca.pem" >nul 2>&1
    if %errorLevel% equ 0 (
        echo     [OK] Certificate installed successfully
    ) else (
        echo     [WARN] Certificate may already be installed or error occurred
    )
) else (
    echo [WARN] Not running as Administrator
    echo [WARN] CA certificate will not be automatically installed
    echo [INFO] You can install it manually from the desktop app later
)

echo.
echo [Step 2/2] Starting Desktop Application...
cd /d "%~dp0"

:: Check if dependencies are installed
if not exist "node_modules" (
    echo [INFO] Installing dependencies...
    call npm install
)

:: Check if Tauri CLI is installed
cd dashboard
if not exist "node_modules\@tauri-apps\cli" (
    echo [INFO] Installing Tauri CLI...
    call npm install
)
cd ..

echo.
echo Starting Network Inspector Desktop App...
echo.

:: Start the Tauri desktop app
call npm run dev:desktop

if %errorLevel% neq 0 (
    echo.
    echo [!] Failed to start desktop app
    echo [!] Check the error messages above
    echo.
    pause
    exit /b 1
)

echo.
pause
