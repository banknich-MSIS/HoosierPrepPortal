# Electron Packaging Guide

This document explains how to build and distribute StudyTool as a desktop application using Electron.

## Prerequisites

### Python Backend

- Python 3.8 or higher
- pip
- PyInstaller (will be installed automatically if missing)
- All Python dependencies from `server/requirements.txt`

### Electron Build

- Node.js 16 or higher
- npm
- electron-builder

## Building the Application

### Option 1: Automated Build Script (Recommended)

From the project root:

```bash
npm install           # Install frontend dependencies
npm install --prefix web  # Install web dependencies if not done
node build-electron.js
```

This will automatically:

1. Build the Python backend executable with PyInstaller
2. Build the frontend with Vite
3. Package everything with electron-builder for your current platform

### Option 2: Manual Step-by-Step

#### 1. Build Python Backend

```bash
cd server
pip install pyinstaller
pyinstaller build.spec
```

This creates `studytool-backend.exe` (Windows) or `studytool-backend` (macOS/Linux) in `server/dist/`

#### 2. Build Frontend

```bash
cd web
npm install
npm run build
```

This creates the production build in `web/dist/`

#### 3. Package Electron App

```bash
cd web
npm run dist:win    # For Windows
npm run dist:mac    # For macOS
npm run dist:linux  # For Linux
```

## Development Mode

To run in development mode (uses system Python and Vite dev server):

```bash
cd web
npm run electron:dev
```

## Output Locations

- **Windows**: `web/dist/Hoosier Prep Portal Setup x.x.x.exe` (installer)
- **macOS**: `web/dist/Hoosier Prep Portal-x.x.x.dmg` (installer)
- **Linux**: `web/dist/Hoosier Prep Portal-x.x.x.AppImage` (portable)

## Security Features

The Electron application implements the following security measures:

- ✅ **Context Isolation**: Enabled (no Node.js access in renderer)
- ✅ **Node Integration**: Disabled in renderer
- ✅ **Content Security Policy**: Strict CSP headers
- ✅ **Input Validation**: All IPC inputs validated and sanitized
- ✅ **Encrypted Storage**: API keys encrypted with AES-256-CTR
- ✅ **Path Sanitization**: Prevents directory traversal attacks
- ✅ **Least Privilege IPC**: Only exposes necessary functions

## Troubleshooting

### Backend Won't Start

- Check if Python backend executable was created in `server/dist/`
- Ensure exam.db exists and is accessible
- Check backend logs in console

### Frontend Can't Connect to Backend

- Verify backend port is available (default 8000)
- Check if backend process is running
- Review IPC communication in DevTools

### Build Fails

- **PyInstaller errors**: Ensure all Python dependencies are installed
- **electron-builder errors**: Check if all required files exist
- **Missing icons**: Add `.ico` (Windows), `.icns` (macOS) files to root directory

## Distribution

### Code Signing

For production distribution, you'll need:

**Windows**:

- Code signing certificate (.pfx or from Windows certificate store)
- Set environment variables or configure in electron-builder

**macOS**:

- Apple Developer ID certificate
- Set `APPLE_ID`, `APPLE_ID_PASSWORD`, and app-specific password

**Linux**:

- Notarization typically not required

### File Sizes

Expected package sizes:

- Windows installer: ~150-250 MB (includes Python interpreter)
- macOS DMG: ~150-250 MB
- Linux AppImage: ~150-250 MB

## Architecture

```
StudyTool Electron App
├── Main Process (main.js)
│   ├── Spawns Python backend executable
│   ├── Manages IPC handlers
│   ├── Encrypts/stores API keys
│   └── Handles window lifecycle
│
├── Preload Script (preload.js)
│   └── Exposes secure API to renderer
│
├── Renderer Process (React App)
│   ├── Calls electronAPI for backend status
│   ├── Communicates with backend via HTTP
│   └── No direct Node.js access
│
└── Python Backend (Packaged Executable)
    ├── FastAPI server
    ├── Database operations
    ├── AI generation
    └── File processing
```

## Security Audit Checklist

Before distribution:

- [ ] No `nodeIntegration: true` in any BrowserWindow
- [ ] `contextIsolation: true` enabled
- [ ] CSP headers properly configured
- [ ] All IPC handlers validate inputs
- [ ] Sensitive data encrypted at rest
- [ ] No hardcoded secrets in code
- [ ] Path traversal prevented in file operations
- [ ] Error messages don't expose system details

## Known Limitations

1. **First Launch**: May take 10-30 seconds to initialize backend
2. **Large Bundle Size**: ~200MB due to Python interpreter
3. **Port Conflicts**: Backend finds free port automatically (starts from 8000)
4. **Gemini API**: Requires internet connection for AI features

## Support

For issues or questions:

- GitHub Issues: https://github.com/banknich-MSIS/StudyTool
- Documentation: See `GEMINI_PROMPT.md` for CSV format specifications
