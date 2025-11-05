# PowerShell script for building StudyTool Electron application
# Run from project root: .\build-electron.ps1

Write-Host "Starting StudyTool build process..." -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

# Check if we're in the correct directory
if (-not (Test-Path "web") -or -not (Test-Path "server")) {
    Write-Host "Error: Must run from project root directory" -ForegroundColor Red
    Write-Host "Current directory: $PWD"
    exit 1
}

try {
    # Step 1: Build Python backend
    Write-Host "Step 1: Building Python backend with PyInstaller..." -ForegroundColor Yellow
    Push-Location server
    
    # Check if PyInstaller is installed
    try {
        python -m PyInstaller --version | Out-Null
    } catch {
        Write-Host "Installing PyInstaller..." -ForegroundColor Gray
        pip install pyinstaller
    }
    
    # Build with PyInstaller using python -m
    python -m PyInstaller build.spec
    Write-Host "Backend build complete" -ForegroundColor Green
    Write-Host ""
    
    # Step 2: Build frontend
    Write-Host "Step 2: Building frontend with Vite..." -ForegroundColor Yellow
    Pop-Location
    Push-Location web
    npm run build
    Write-Host "Frontend build complete" -ForegroundColor Green
    Write-Host ""
    
    # Step 3: Package with electron-builder
    Write-Host "Step 3: Packaging for Windows..." -ForegroundColor Yellow
    npm run dist:win
    Write-Host "Packaging complete" -ForegroundColor Green
    Write-Host ""
    
    Pop-Location
    
    Write-Host "Build complete! Check the web/dist folder for your packaged application." -ForegroundColor Cyan
    
} catch {
    Write-Host "Build failed: $_" -ForegroundColor Red
    Pop-Location
    exit 1
}
