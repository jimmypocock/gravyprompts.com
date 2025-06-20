const path = require('path');

// Common module name mapper for Lambda layers
const moduleNameMapper = {
  "^/opt/nodejs/(.*)$": "<rootDir>/lambda-layers/shared/nodejs/$1",
};

// Use environment variable to determine which config to use
if (process.env.JEST_CONFIG_TYPE === 'unit') {
  // Unit test configuration
  module.exports = {
    rootDir: __dirname,
    testEnvironment: "node",
    testMatch: [
      "**/lambda/**/__tests__/**/*.test.js",
      "**/lambda-layers/**/__tests__/**/*.test.js",
      "!**/__tests__/**/*.integration.test.js",
      "!**/__tests__/**/*.e2e.test.js",
    ],
    testPathIgnorePatterns: [
      "/node_modules/",
      "/cdk.out/",
      "integration\\.test\\.js$",
      "e2e\\.test\\.js$",
      "setup-.*\\.js$",
      "debug-.*\\.js$",
      "test-helpers",
    ],
    modulePathIgnorePatterns: ["/cdk.out/"],
    watchPathIgnorePatterns: ["/cdk.out/"],
    setupFiles: ["<rootDir>/test-setup.js"],
    setupFilesAfterEnv: ["<rootDir>/jest.setup.unit.js"],
    moduleNameMapper,
    silent: true, // Suppress console output during tests
  };
} else {
  // Default configuration
  module.exports = {
    rootDir: __dirname,
    testEnvironment: "node",
    roots: ["<rootDir>/lambda", "<rootDir>/lambda-layers"],
    testMatch: ["**/__tests__/**/*.js", "**/?(*.)+(spec|test).js"],
    testPathIgnorePatterns: ["/node_modules/", "/cdk.out/"],
    modulePathIgnorePatterns: ["/cdk.out/"],
    watchPathIgnorePatterns: ["/cdk.out/"],
    collectCoverageFrom: [
      "lambda/**/*.js",
      "lambda-layers/**/*.js",
      "!**/__tests__/**",
      "!**/node_modules/**",
    ],
    coverageThreshold: {
      global: {
        branches: 70,
        functions: 70,
        lines: 70,
        statements: 70,
      },
    },
    moduleNameMapper,
    setupFiles: ["<rootDir>/test-setup.js"],
    silent: true, // Suppress console output during tests
  };
}
