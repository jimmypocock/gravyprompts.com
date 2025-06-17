const nextJest = require("next/jest");

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    // Handle module aliases (matching tsconfig paths)
    "^@/(.*)$": "<rootDir>/$1",
  },
  moduleDirectories: ["node_modules", "<rootDir>/"],
  testMatch: [
    "<rootDir>/**/__tests__/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/**/*.{spec,test}.{js,jsx,ts,tsx}",
  ],
  testPathIgnorePatterns: [
    "<rootDir>/.next/",
    "<rootDir>/node_modules/",
    "<rootDir>/cdk/", // Ignore backend tests
    "<rootDir>/packages/", // Ignore package tests
  ],
  modulePathIgnorePatterns: ["<rootDir>/cdk/cdk.out/", "<rootDir>/.next/"],
  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/.next/",
    "/cdk/",
    "/packages/",
  ],
  collectCoverageFrom: [
    "app/**/*.{js,jsx,ts,tsx}",
    "components/**/*.{js,jsx,ts,tsx}",
    "lib/**/*.{js,jsx,ts,tsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  // Retry failed tests up to 2 times
  testRetries: process.env.CI ? 2 : 0,
  // Increase timeout for E2E tests
  testTimeout: process.env.CI ? 30000 : 10000,
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
