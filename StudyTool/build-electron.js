/**
 * Build script for packaging StudyTool Electron application
 *
 * This script:
 * 1. Builds the Python backend with PyInstaller
 * 2. Builds the frontend with Vite
 * 3. Packages everything with electron-builder
 */

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

console.log("🚀 Starting StudyTool build process...\n");

// Check if we're in the correct directory
const cwd = process.cwd();
const webDir = path.join(cwd, "web");
const serverDir = path.join(cwd, "server");

if (!fs.existsSync(webDir) || !fs.existsSync(serverDir)) {
  console.error("❌ Error: Must run from project root directory");
  console.error("Current directory:", cwd);
  process.exit(1);
}

try {
  // Step 1: Build Python backend
  console.log("📦 Step 1: Building Python backend with PyInstaller...");
  process.chdir(serverDir);

  // Check if PyInstaller is installed
  try {
    execSync("pyinstaller --version", { stdio: "ignore" });
  } catch {
    console.error("❌ PyInstaller not found. Installing...");
    execSync("pip install pyinstaller", { stdio: "inherit" });
  }

  // Build with PyInstaller
  execSync("pyinstaller build.spec", { stdio: "inherit" });
  console.log("✅ Backend build complete\n");

  // Step 2: Build frontend
  console.log("📦 Step 2: Building frontend with Vite...");
  process.chdir(webDir);
  execSync("npm run build", { stdio: "inherit" });
  console.log("✅ Frontend build complete\n");

  // Step 3: Package with electron-builder
  const platform = process.platform;
  console.log(`📦 Step 3: Packaging for ${platform}...`);

  let command = "electron-builder";
  if (platform === "win32") {
    command += " --win";
  } else if (platform === "darwin") {
    command += " --mac";
  } else if (platform === "linux") {
    command += " --linux";
  }

  execSync(command, { stdio: "inherit", env: { ...process.env } });
  console.log("✅ Packaging complete\n");

  console.log(
    "🎉 Build complete! Check the dist folder for your packaged application."
  );
} catch (error) {
  console.error("❌ Build failed:", error.message);
  process.exit(1);
}
