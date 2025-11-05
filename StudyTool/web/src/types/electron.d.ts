/**
 * Type definitions for Electron API exposed via preload script
 */

export interface ElectronAPI {
  getAppVersion: () => Promise<string>;
  getBackendStatus: () => Promise<{ running: boolean; port: number }>;
  saveApiKey: (key: string) => Promise<boolean>;
  loadApiKey: () => Promise<string | null>;
  getPlatform: () => string;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
