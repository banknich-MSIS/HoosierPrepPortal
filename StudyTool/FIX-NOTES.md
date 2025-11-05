# Fix for Backend Executable Issue

## Problem

The Electron app can't find the backend executable because:

1. electron-builder copies it as just `backend` (no .exe extension)
2. The path in main.js was looking for `studytool-backend.exe`

## Solution Applied

Updated `web/electron/main.js` to look for the backend at:

```
resources/backend
```

The fix is already in place. You now need to:

1. Close any running Electron instances
2. Rebuild the app
3. Test it

## Quick Fix Command

```powershell
# Close Electron
Get-Process | Where-Object {$_.ProcessName -like "*electron*" -or $_.ProcessName -like "*Hoosier*"} | Stop-Process -Force

# Remove locked files and rebuild
cd "X:\StudyTool Local App Project\StudyTool-1\web"
Remove-Item "dist\win-unpacked" -Recurse -Force
npm run build
npx electron-builder --win --config.win.sign=false
```

## What Changed

The backend spawn path now correctly references:

- Production: `resources/backend` (the actual filename from extraResources)
- Development: `python -m uvicorn` (unchanged)
