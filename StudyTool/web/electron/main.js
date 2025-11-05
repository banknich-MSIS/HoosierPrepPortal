const { app, BrowserWindow, ipcMain, session, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const crypto = require("crypto");
let backendProc;
let backendPort = 8000;

function waitForHealth(url, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      fetch(url)
        .then((r) => (r.ok ? resolve() : Promise.reject()))
        .catch(() => {
          if (Date.now() - start > timeoutMs)
            return reject(new Error("Backend healthcheck timed out"));
          setTimeout(tick, 300);
        });
    };
    tick();
  });
}

/**
 * Show error dialog for backend failures
 */
function showBackendError(message) {
  console.error("Backend Error:", message);
  try {
    dialog.showErrorBox(
      "Backend Error",
      `Failed to start backend server:\n\n${message}\n\nCheck console for details.`
    );
  } catch (e) {
    // Fallback if dialog not available
    console.error("Could not show error dialog:", e);
  }
}

/**
 * Health check with retry and exponential backoff
 */
async function waitForHealthWithRetry(url, maxRetries = 5, initialDelay = 500) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`Health check successful on attempt ${i + 1}`);
        return true;
      }
      console.log(
        `Health check attempt ${i + 1} failed: HTTP ${response.status}`
      );
    } catch (error) {
      console.error(`Health check attempt ${i + 1} error:`, error.message);
    }

    if (i < maxRetries - 1) {
      const delay = initialDelay * Math.pow(2, i);
      console.log(`Retrying health check in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return false;
}

/**
 * Find an available port starting from the default
 */
function findFreePort(startPort = 8000) {
  return new Promise((resolve, reject) => {
    const net = require("net");

    function tryPort(port) {
      const server = net.createServer();

      server.listen(port, () => {
        const foundPort = server.address().port;
        server.close(() => resolve(foundPort));
      });

      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          // Port is in use, try next one
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
    }

    tryPort(startPort);
  });
}

/**
 * Sanitize file paths to prevent directory traversal attacks
 */
function sanitizePath(inputPath, baseDir) {
  const normalized = path.normalize(inputPath);

  // Check for directory traversal
  if (normalized.includes("..")) {
    throw new Error("Invalid path: directory traversal detected");
  }

  // Ensure within base directory
  const fullPath = path.resolve(baseDir, normalized);
  const resolvedBase = path.resolve(baseDir);

  if (!fullPath.startsWith(resolvedBase)) {
    throw new Error("Invalid path: outside base directory");
  }

  return fullPath;
}

/**
 * Encrypt sensitive data
 */
function encrypt(text) {
  const algorithm = "aes-256-ctr";
  const key = crypto.scryptSync("studytool-key", "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

/**
 * Decrypt sensitive data
 */
function decrypt(encryptedText) {
  const algorithm = "aes-256-ctr";
  const key = crypto.scryptSync("studytool-key", "salt", 32);
  const [ivHex, encryptedHex] = encryptedText.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString();
}

// Configure Content Security Policy
app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https:; " +
            "connect-src 'self' http://127.0.0.1:*; " +
            "font-src 'self' data:",
        ],
      },
    });
  });
});

async function createWindow() {
  // Find free port for backend
  backendPort = await findFreePort();

  // Spawn Python backend executable
  // Determine if we're in development or production
  const isDev = !process.resourcesPath || !app.isPackaged;
  let exePath;

  if (isDev) {
    // Development mode - use the backend from server/dist
    exePath = path.resolve(
      __dirname,
      "..",
      "..",
      "server",
      "dist",
      "studytool-backend.exe"
    );
  } else {
    // Production - use packaged backend from resources
    exePath = path.join(process.resourcesPath, "backend");
  }

  console.log("Looking for backend at:", exePath);
  console.log("Exists:", fs.existsSync(exePath));

  if (!fs.existsSync(exePath)) {
    console.error("ERROR: Backend executable not found!");
    console.error("Searched:", exePath);
    console.error("Is packaged:", !!process.resourcesPath);
    const errorMsg = `Backend executable not found.\n\nSearched: ${exePath}\n\nPlease ensure the backend is built by running:\ncd server && python -m PyInstaller build.spec`;
    showBackendError(errorMsg);
    throw new Error(errorMsg);
  }

  backendProc = spawn(exePath, ["--port", backendPort.toString()]);

  // Log backend output for debugging with timestamps
  backendProc.stdout.on("data", (data) => {
    console.log(`[Backend ${new Date().toLocaleTimeString()}] ${data}`);
  });

  backendProc.stderr.on("data", (data) => {
    console.error(`[Backend Error ${new Date().toLocaleTimeString()}] ${data}`);
  });

  // Handle backend process errors
  backendProc.on("error", (error) => {
    console.error("Failed to start backend process:", error);
    showBackendError(`Failed to start backend: ${error.message}`);
  });

  // Handle backend process exit
  backendProc.on("exit", (code, signal) => {
    console.log(
      `Backend process exited with code ${code} and signal ${signal}`
    );
    if (code !== 0 && code !== null) {
      showBackendError(`Backend crashed with exit code ${code}`);
    }
  });

  // Create browser window with security settings
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false, // ✅ Security: No Node.js in renderer
      contextIsolation: true, // ✅ Security: Isolated context
      enableRemoteModule: false, // ✅ Security: No remote module
      worldSafeExecuteJavaScript: true, // ✅ Security: Safe JS execution
      webSecurity: true,
    },
  });

  // Open DevTools in development mode
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    win.webContents.openDevTools();
    console.log("DevTools opened for debugging");
  }

  const indexPath = path.join(__dirname, "..", "dist-vite", "index.html");

  (async () => {
    console.log("Waiting for backend to be ready...");
    const backendReady = await waitForHealthWithRetry(
      `http://127.0.0.1:${backendPort}/api/health`
    );

    if (backendReady) {
      console.log("Backend is ready, loading frontend...");
      await win.loadFile(indexPath);
    } else {
      console.error("Backend failed to start within timeout");
      showBackendError(
        "Backend failed to respond to health checks. Check console for details."
      );
      // Load frontend anyway so user can see there's an error
      await win.loadFile(indexPath);
    }
  })();

  win.on("closed", () => {
    if (backendProc) {
      try {
        backendProc.kill();
      } catch (_) {}
    }
  });

  // Store window reference for IPC handlers
  global.mainWindow = win;
}

// IPC Handlers with input validation
ipcMain.handle("app-version", () => {
  return app.getVersion();
});

ipcMain.handle("backend-status", () => {
  return {
    running: backendProc && !backendProc.killed,
    port: backendPort,
  };
});

ipcMain.handle("save-api-key", async (event, key) => {
  // ✅ Validate input
  if (typeof key !== "string" || key.length === 0) {
    throw new Error("Invalid API key format");
  }

  // ✅ Sanitize input
  const sanitized = key.trim().replace(/[\x00-\x1F\x7F]/g, "");

  // ✅ Save to secure location
  const userDataPath = app.getPath("userData");
  const keyPath = path.join(userDataPath, "api-key.enc");

  // ✅ Encrypt before storing
  const encrypted = encrypt(sanitized);

  fs.writeFileSync(keyPath, encrypted, { mode: 0o600 });
  return true;
});

ipcMain.handle("load-api-key", () => {
  try {
    const userDataPath = app.getPath("userData");
    const keyPath = path.join(userDataPath, "api-key.enc");

    if (!fs.existsSync(keyPath)) {
      return null;
    }

    const encrypted = fs.readFileSync(keyPath, "utf8");
    return decrypt(encrypted);
  } catch (error) {
    console.error("Error loading API key:", error);
    return null;
  }
});

ipcMain.handle("window-minimize", () => {
  if (global.mainWindow) {
    global.mainWindow.minimize();
  }
});

ipcMain.handle("window-maximize", () => {
  if (global.mainWindow) {
    if (global.mainWindow.isMaximized()) {
      global.mainWindow.unmaximize();
    } else {
      global.mainWindow.maximize();
    }
  }
});

ipcMain.handle("window-close", () => {
  if (global.mainWindow) {
    global.mainWindow.close();
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
