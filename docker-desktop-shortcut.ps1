# Quick script to open Docker Desktop and remind user about the containers
Write-Host "Opening Docker Desktop..." -ForegroundColor Green
Write-Host ""

# Try to open Docker Desktop (if installed in default location)
$dockerDesktopPaths = @(
    "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
    "${env:ProgramFiles(x86)}\Docker\Docker\Docker Desktop.exe",
    "$env:LOCALAPPDATA\Docker\Docker Desktop.exe"
)

$opened = $false
foreach ($path in $dockerDesktopPaths) {
    if (Test-Path $path) {
        Start-Process $path
        $opened = $true
        break
    }
}

if (-not $opened) {
    Write-Host "Docker Desktop not found in common locations." -ForegroundColor Yellow
    Write-Host "Please open Docker Desktop manually." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Once Docker Desktop opens:" -ForegroundColor Cyan
Write-Host "  1. Click 'Containers' in the left sidebar" -ForegroundColor White
Write-Host "  2. Find 'hoosier-prep-portal'" -ForegroundColor White
Write-Host "  3. Click the ▶️ Start button" -ForegroundColor White
Write-Host ""
Write-Host "Or run: docker-compose up -d" -ForegroundColor Gray

