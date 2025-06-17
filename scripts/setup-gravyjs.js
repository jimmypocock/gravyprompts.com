#!/usr/bin/env node

/**
 * Post-install script to set up gravyjs workspace packages
 * This ensures that the gravyjs packages are properly installed
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Prevent infinite loops - skip if already running
if (process.env.GRAVYJS_SETUP_RUNNING === "true") {
  process.exit(0);
}

console.log("📦 Setting up GravyJS packages...");

// Check if we're in CI environment
const isCI = process.env.CI === "true";

// Check if packages directory exists
const packagesDir = path.join(__dirname, "..", "packages");
if (!fs.existsSync(packagesDir)) {
  console.log("✅ No packages directory found, skipping setup");
  process.exit(0);
}

// Check if this is the root package installation
const currentDir = process.cwd();
const rootDir = path.join(__dirname, "..");
if (currentDir !== rootDir) {
  console.log("✅ Not in root directory, skipping workspace setup");
  process.exit(0);
}

// Install dependencies for each package
const packages = ["gravyjs", "gravyjs-demo"];

packages.forEach((pkg) => {
  const pkgPath = path.join(packagesDir, pkg);
  if (fs.existsSync(pkgPath)) {
    console.log(`📦 Installing dependencies for ${pkg}...`);
    try {
      // Skip installing packages in CI if they're private/local
      if (isCI && pkg === "gravyjs-demo") {
        console.log(`⏭️  Skipping ${pkg} in CI environment`);
        return;
      }

      execSync("npm install --ignore-scripts", {
        cwd: pkgPath,
        stdio: "inherit",
        env: { ...process.env, GRAVYJS_SETUP_RUNNING: "true" },
      });
      console.log(`✅ ${pkg} dependencies installed`);

      // Build the package if it's gravyjs and we're in CI
      if (isCI && pkg === "gravyjs") {
        console.log(`🔨 Building ${pkg} for CI...`);
        execSync("npm run build", {
          cwd: pkgPath,
          stdio: "inherit",
          env: { ...process.env, GRAVYJS_SETUP_RUNNING: "true" },
        });
        console.log(`✅ ${pkg} built successfully`);
      }
    } catch (error) {
      console.error(
        `❌ Failed to install dependencies for ${pkg}:`,
        error.message,
      );
      // Don't fail the entire install if a workspace package fails
      if (isCI) {
        console.log(`⚠️  Continuing despite ${pkg} installation failure in CI`);
      }
    }
  }
});

console.log("✅ GravyJS setup complete");
