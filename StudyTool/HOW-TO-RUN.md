# How to Run StudyTool Electron App

## Option 1: Development Mode (Current Setup)

From the project root or `web` directory, run:

```powershell
cd web
npm run electron:dev
```

This will:

- ✅ Launch Electron window
- ✅ Start Python backend from `server/dist/studytool-backend.exe`
- ✅ Load frontend from `dist-vite/`
- ✅ Work immediately without packaging

## Option 2: Packaging for Distribution

To create a distributable executable:

```powershell
cd web
npm run dist:win
```

This creates installers in `web/dist/`

## What's Happening Now

The app is currently running in development mode. When you see the Electron window, you should see the StudyTool interface.

## If You See Issues

1. **White screen**: Check backend is starting (look for backend logs in terminal)
2. **404 errors**: Backend isn't running properly
3. **Console errors**: Check electron window DevTools (Ctrl+Shift+I)

## File Locations

- Backend executable: `server/dist/studytool-backend.exe`
- Frontend build: `web/dist-vite/`
- Electron code: `web/electron/`
