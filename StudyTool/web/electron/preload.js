/**
 * Preload Script - Secure IPC Bridge
 *
 * This script follows the principle of least privilege:
 * - Only exposes specific functions, not entire modules
 * - All data is validated in the main process
 * - No direct Node.js access to renderer
 */

const { contextBridge, ipcRenderer } = require("electron");

// Expose only necessary API to renderer
contextBridge.exposeInMainWorld("electronAPI", {
  // App information
  getAppVersion: () => ipcRenderer.invoke("app-version"),

  // Backend status
  getBackendStatus: () => ipcRenderer.invoke("backend-status"),

  // API Key management (encrypted)
  saveApiKey: (key) => ipcRenderer.invoke("save-api-key", key),
  loadApiKey: () => ipcRenderer.invoke("load-api-key"),

  // Platform information
  getPlatform: () => process.platform,

  // Window controls
  minimizeWindow: () => ipcRenderer.invoke("window-minimize"),
  maximizeWindow: () => ipcRenderer.invoke("window-maximize"),
  closeWindow: () => ipcRenderer.invoke("window-close"),
});

/**
 * Example of what NOT to do:
 *
 * // ❌ NEVER expose entire modules
 * contextBridge.exposeInMainWorld('dangerous', {
 *   fs: require('fs'),
 *   child_process: require('child_process'),
 *   shell: require('electron').shell
 * });
 */
