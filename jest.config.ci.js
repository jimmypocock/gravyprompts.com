const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

// CI-specific Jest configuration
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  moduleDirectories: ["node_modules", "<rootDir>/"],
  // Only run tests that work reliably in CI
  testMatch: [
    "<rootDir>/components/**/__tests__/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/__tests__/contracts/**/*.test.{js,jsx,ts,tsx}",
    "<rootDir>/__tests__/dummy.test.js",
    "<rootDir>/__tests__/components/**/*.test.{js,jsx,ts,tsx}",
    "<rootDir>/__tests__/lambda/**/*.test.{js,jsx,ts,tsx}",
  ],
  // Exclude problematic test directories
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/cdk/",
    "<rootDir>/packages/",
    "<rootDir>/__tests__/security/",
    "<rootDir>/__tests__/e2e/",
    "<rootDir>/__tests__/integration/",
  ],
  modulePathIgnorePatterns: ["<rootDir>/cdk/cdk.out/", "<rootDir>/.next/"],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/.next/",
    "/cdk/",
    "/packages/",
    "/__tests__/security/",
    "/__tests__/e2e/",
  ],
  collectCoverageFrom: [
    "app/**/*.{js,jsx,ts,tsx}",
    "components/**/*.{js,jsx,ts,tsx}",
    "lib/**/*.{js,jsx,ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  // Faster CI execution
  maxWorkers: "50%",
  // Don't retry in CI
  bail: 1,
  testTimeout: 10000,
};

module.exports = createJestConfig(customJestConfig);
