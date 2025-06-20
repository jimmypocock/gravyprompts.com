const path = require('path');

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
  moduleNameMapper: {
    "^/opt/nodejs/(.*)$": "<rootDir>/lambda-layers/shared/nodejs/$1",
  },
};