const path = require('path');

module.exports = {
  rootDir: __dirname,
  testEnvironment: "node",
  testMatch: [
    "**/lambda/**/__tests__/**/*.integration.test.js",
    "**/lambda/**/__tests__/**/*.e2e.test.js",
  ],
  testPathIgnorePatterns: ["/node_modules/", "/cdk.out/"],
  modulePathIgnorePatterns: ["/cdk.out/"],
  watchPathIgnorePatterns: ["/cdk.out/"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.integration.js"],
  testTimeout: 30000, // Integration tests need more time
  moduleNameMapper: {
    "^/opt/nodejs/(.*)$": "<rootDir>/lambda-layers/shared/nodejs/$1",
  },
};
