# Hoosier Prep Portal Desktop Shortcut Creator
# Run this script once to create a desktop shortcut for easy access

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Hoosier Prep Portal - Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Creating desktop shortcut..." -ForegroundColor Yellow

$ShortcutPath = "$env:USERPROFILE\Desktop\Hoosier Prep Portal.lnk"
$TargetPath = "powershell.exe"
$WorkingDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$Arguments = '-ExecutionPolicy Bypass -NoExit -File "' + (Join-Path $WorkingDirectory 'start.ps1') + '"'
$IconPath = Join-Path $WorkingDirectory 'assets\HoosierPrepPortal.ico'

# Verify icon file exists
if (!(Test-Path $IconPath)) {
    Write-Host "  Warning: Icon file not found at $IconPath" -ForegroundColor Yellow
    Write-Host "  Shortcut will be created without custom icon." -ForegroundColor Yellow
}

try {
    # Create the shortcut
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = $TargetPath
    $Shortcut.Arguments = $Arguments
    $Shortcut.WorkingDirectory = $WorkingDirectory
    $Shortcut.IconLocation = $IconPath
    $Shortcut.Description = "Launch Hoosier Prep Portal - AI-powered exam generation and practice tool"
    $Shortcut.Save()
    
    Write-Host ""
    Write-Host "✓ Desktop shortcut created successfully!" -ForegroundColor Green
    Write-Host "  Location: $ShortcutPath" -ForegroundColor Gray
} catch {
    Write-Host ""
    Write-Host "✗ Failed to create shortcut: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now:" -ForegroundColor White
Write-Host "  • Double-click the desktop shortcut to launch the portal" -ForegroundColor Gray
Write-Host "  • Or run: .\start.ps1 from this directory" -ForegroundColor Gray
Write-Host ""
Write-Host "The portal will open at: http://127.0.0.1:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: Keep this folder in its current location for the shortcut to work." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
