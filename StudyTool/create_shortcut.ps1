# Hoosier Prep Portal Setup Script
# Run this script once to set up the desktop shortcut and custom domain

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "This script needs Administrator privileges to configure the custom domain." -ForegroundColor Yellow
    Write-Host "Requesting elevation..." -ForegroundColor Cyan
    
    # Re-launch as administrator
    $scriptPath = $MyInvocation.MyCommand.Path
    Start-Process powershell.exe "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`"" -Verb RunAs
    exit
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Hoosier Prep Portal - Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Configure custom domain in hosts file
Write-Host "[1/2] Configuring custom domain (hoosierprep.local)..." -ForegroundColor Yellow

$hostsPath = "$env:windir\System32\drivers\etc\hosts"
$domain = "hoosierprep.local"
$hostsEntry = "127.0.0.1    $domain"

# Check if entry already exists
$hostsContent = Get-Content $hostsPath -ErrorAction SilentlyContinue
$entryExists = $hostsContent | Select-String -Pattern $domain -Quiet

if ($entryExists) {
    Write-Host "  ✓ Custom domain already configured" -ForegroundColor Green
} else {
    try {
        # Add entry to hosts file
        Add-Content -Path $hostsPath -Value "`n# Hoosier Prep Portal`n$hostsEntry" -ErrorAction Stop
        Write-Host "  ✓ Custom domain added successfully" -ForegroundColor Green
        Write-Host "    You can now access the portal at: http://hoosierprep.local:5173" -ForegroundColor Gray
    } catch {
        Write-Host "  ✗ Failed to update hosts file: $_" -ForegroundColor Red
        Write-Host "    The app will still work using http://127.0.0.1:5173" -ForegroundColor Yellow
    }
}

Write-Host ""

# Step 2: Create desktop shortcut
Write-Host "[2/2] Creating desktop shortcut..." -ForegroundColor Yellow

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
    
    Write-Host "  ✓ Desktop shortcut created successfully" -ForegroundColor Green
    Write-Host "    Location: $ShortcutPath" -ForegroundColor Gray
} catch {
    Write-Host "  ✗ Failed to create shortcut: $_" -ForegroundColor Red
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
Write-Host "The portal will open at: http://hoosierprep.local:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: Keep this folder in its current location for the shortcut to work." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to exit..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
