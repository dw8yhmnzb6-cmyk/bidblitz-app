// craco.config.js
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const webpack = require("webpack");
const { execFileSync, execSync } = require("child_process");

const asEnabled = (value) => String(value || "").trim().toLowerCase() === "true";

if (!process.env.REACT_APP_TEST_MODE && process.env.TEST_MODE) {
  process.env.REACT_APP_TEST_MODE = process.env.TEST_MODE;
}

if (!process.env.REACT_APP_TEST_MODE_FULL_ACCESS && (asEnabled(process.env.REACT_APP_TEST_MODE) || asEnabled(process.env.REACT_APP_DISABLE_KYC))) {
  process.env.REACT_APP_TEST_MODE_FULL_ACCESS = "true";
}

if (!process.env.REACT_APP_KYC_REQUIRED && (process.env.REACT_APP_TEST_MODE_FULL_ACCESS === "true" || asEnabled(process.env.REACT_APP_DISABLE_KYC))) {
  process.env.REACT_APP_KYC_REQUIRED = "false";
}

if (!process.env.REACT_APP_SHOW_KYC_GATE && process.env.REACT_APP_KYC_REQUIRED === "false") {
  process.env.REACT_APP_SHOW_KYC_GATE = "false";
}

if (!process.env.REACT_APP_SHOW_LIVE_CHECK_BANNER) {
  process.env.REACT_APP_SHOW_LIVE_CHECK_BANNER = "false";
}

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

function syncBuildMetadata() {
  const repoRoot = path.resolve(__dirname, "..");
  const commit = (() => {
    try {
      return execSync(`git -C "${repoRoot}" rev-parse HEAD`, { encoding: "utf8" }).trim();
    } catch {
      return "unknown";
    }
  })();
  const shortCommit = commit === "unknown" ? "unknown" : commit.slice(0, 7);
  const buildId = `${shortCommit}-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}`;
  const backendUrl = process.env.REACT_APP_BACKEND_URL || "";
  const buildEnvironment = backendUrl.includes("bidblitz.ae") && !backendUrl.includes("preview") ? "production" : "preview";

  process.env.REACT_APP_BUILD_ID = buildId;
  process.env.REACT_APP_GIT_COMMIT = commit;

  execFileSync("python3", [path.resolve(repoRoot, "scripts/generate_build_info.py")], {
    cwd: repoRoot,
    env: {
      ...process.env,
      BUILD_ENVIRONMENT: buildEnvironment,
      BUILD_API_BASE_URL: backendUrl,
      BUILD_PUBLIC_BASE_URL: backendUrl,
      BUILD_FRONTEND_VERSION: buildId,
    },
    stdio: "inherit",
  });
}

// Load .env files in the correct order:
//   - Dev: load `.env` only (preview URL for sandbox)
//   - Prod build: load `.env.production` FIRST (higher priority),
//     then `.env` for anything not already set.
// dotenv never overwrites already-set vars, so this gives .env.production priority.
if (isDevServer) {
  require("dotenv").config();
} else {
  require("dotenv").config({ path: path.resolve(__dirname, ".env.production") });
  require("dotenv").config();
  syncBuildMetadata();
}

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

let webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }
      webpackConfig.plugins.push(
        new webpack.DefinePlugin({
          "process.env.REACT_APP_TEST_MODE": JSON.stringify(process.env.REACT_APP_TEST_MODE),
          "process.env.REACT_APP_TEST_MODE_FULL_ACCESS": JSON.stringify(process.env.REACT_APP_TEST_MODE_FULL_ACCESS),
          "process.env.REACT_APP_DISABLE_KYC": JSON.stringify(process.env.REACT_APP_DISABLE_KYC),
          "process.env.REACT_APP_KYC_REQUIRED": JSON.stringify(process.env.REACT_APP_KYC_REQUIRED),
          "process.env.REACT_APP_SHOW_KYC_GATE": JSON.stringify(process.env.REACT_APP_SHOW_KYC_GATE),
          "process.env.REACT_APP_SHOW_LIVE_CHECK_BANNER": JSON.stringify(process.env.REACT_APP_SHOW_LIVE_CHECK_BANNER),
          "process.env.REACT_APP_BUILD_ID": JSON.stringify(process.env.REACT_APP_BUILD_ID),
          "process.env.REACT_APP_GIT_COMMIT": JSON.stringify(process.env.REACT_APP_GIT_COMMIT),
        })
      );
      return webpackConfig;
    },
  },
};

webpackConfig.devServer = (devServerConfig) => {
  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

// Wrap with visual edits (automatically adds babel plugin, dev server, and overlay in dev mode)
if (isDevServer) {
  try {
    const { withVisualEdits } = require("@emergentbase/visual-edits/craco");
    webpackConfig = withVisualEdits(webpackConfig);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('@emergentbase/visual-edits/craco')) {
      console.warn(
        "[visual-edits] @emergentbase/visual-edits not installed — visual editing disabled."
      );
    } else {
      throw err;
    }
  }
}

module.exports = webpackConfig;
