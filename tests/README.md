# Local Testing Guide

This directory contains comprehensive tests to verify the application is working properly.

## Quick Start

```bash
# Run health check (fastest)
npm run test:health

# Run all local tests
npm run test:local:all

# Run Playwright E2E tests with UI
npm run test:playwright:ui
```

## Available Tests

### 1. Health Check (`npm run test:health`)
Quick verification that all services are running:
- Docker containers (DynamoDB, LocalStack, Redis)
- Web services (App, API, Demo)
- Process checks (Next.js, Vite, SAM)

### 2. E2E Tests (`npm run test:playwright`)
Comprehensive browser tests:
- **gravyjs.spec.ts** - Tests the main app's GravyJS integration
- **gravyjs-demo.spec.ts** - Tests the standalone demo
- **health-check.spec.ts** - API and service availability
- **visual-regression.spec.ts** - Visual screenshot comparisons

### 3. Unit Tests
- `npm test` - Run Jest unit tests
- `npm run test:coverage` - With coverage report

## Running Tests

### Prerequisites
1. Start all services:
   ```bash
   npm run dev:all
   ```

2. Wait for services to be ready:
   ```bash
   npm run test:health
   ```

### Running Specific Tests

```bash
# Run only GravyJS tests
npx playwright test gravyjs.spec.ts

# Run with specific browser
npx playwright test --project=chromium

# Debug mode (opens browser)
npx playwright test --debug

# Update visual snapshots
npx playwright test --update-snapshots
```

## Test Structure

```
tests/
├── e2e/
│   ├── gravyjs.spec.ts         # Main app GravyJS tests
│   ├── gravyjs-demo.spec.ts    # Demo app tests
│   ├── health-check.spec.ts    # Service availability
│   └── visual-regression.spec.ts # Screenshot tests
└── README.md
```

## What Gets Tested

### GravyJS Integration
- ✅ Editor loads in template quickview
- ✅ Toolbar functionality (bold, italic, etc.)
- ✅ Variable insertion and population
- ✅ Content editing and formatting
- ✅ No console errors

### API Integration
- ✅ Templates load from API
- ✅ Correct data structure
- ✅ Error handling

### Visual Regression
- ✅ Editor appearance
- ✅ Toolbar states
- ✅ Variable styling
- ✅ Populated content display

## Troubleshooting

### Tests fail with "Connection refused"
- Services aren't running: `npm run dev:all`
- Wrong ports: Check `localhost:6827` (app) and `localhost:5173` (demo)

### Visual tests fail
- Update snapshots: `npx playwright test --update-snapshots`
- Check screenshots: `npx playwright show-report`

### Timeout errors
- Increase timeout in tests or playwright.config.ts
- Check if services are slow to start

## CI/CD Note

These tests are designed for local development. For CI/CD:
- Use `npm run test:ci` for Jest tests
- Playwright tests would need headless configuration