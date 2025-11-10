# Hoosier Prep Portal - Setup Instructions

## Quick Start

### 1. Install Dependencies

First time setup requires installing both backend and frontend dependencies:

#### Backend (Python)

```powershell
cd server
pip install -r requirements.txt
```

#### Frontend (Node.js)

```powershell
cd web
npm install
```

### 2. Configure API Key

You'll need a free Gemini API key for AI-powered exam generation:

1. Get your API key at: https://aistudio.google.com/app/apikey
2. Launch the app and navigate to Settings
3. Enter your API key and save

### 3. Create Desktop Shortcut (Recommended)

For easy access, create a desktop shortcut:

```powershell
.\create_shortcut.ps1
```

This will create a "Hoosier Prep Portal" shortcut on your desktop with:

- Custom Hoosier Prep icon
- Automatic launch of both frontend and backend
- Proper working directory configuration

### 4. Manual Launch

If you prefer not to use the shortcut, you can launch manually:

```powershell
.\start.ps1
```

This will:

- Start the Python backend server on port 8000
- Start the Vite development server on port 5173
- Open your browser to http://127.0.0.1:5173
- Keep both servers running until you press any key to stop

## Asset Organization

All project assets are organized in the `/assets` folder:

- `HoosierPrepPortal.ico` - Windows icon for desktop shortcut
- `HoosierPrepPortal.png` - Web favicon and general branding
- `IURedLogo.svg` - Indiana University logo (red version)
- `IUGreyLogo.svg` - Indiana University logo (grey version)

The frontend references these assets from the centralized location, ensuring consistency across the application.

## Stopping the Application

To stop the servers:

1. Go to the PowerShell window running `start.ps1`
2. Press any key
3. Both servers will shut down gracefully

Or run:

```powershell
.\stop.ps1
```

## Troubleshooting

### Port Already in Use

If ports 8000 or 5173 are already in use, the start script will detect this and prompt you to stop existing processes.

### API Key Not Working

- Verify your API key is valid at https://aistudio.google.com/app/apikey
- Ensure you're using a personal Google account (not IU account) for the API key
- Check that the key has proper permissions for Gemini models

### Database Issues

If you encounter database errors, the `exam.db` file may be corrupted. You can safely delete it and restart the app to create a fresh database.

## Development

For development with hot reload:

**Backend:**

```powershell
cd server
uvicorn main:app --reload --port 8000
```

**Frontend:**

```powershell
cd web
npm run dev
```

## Building for Production

To create a production build:

```powershell
cd web
npm run build
```

The built files will be in `web/dist`.

## Support

For issues, questions, or contributions, visit:
https://github.com/banknich-MSIS/HoosierPrepPortal
