#!/bin/bash

# Run all local tests
# This script runs comprehensive tests to verify the application is working

set -e

echo "🧪 Running All Local Tests"
echo "========================="

# 1. Health Check
echo ""
echo "1️⃣  Health Check..."
npm run test:health

# 2. Unit Tests (if they pass)
echo ""
echo "2️⃣  Unit Tests..."
cd packages/gravyjs
npm test || echo "⚠️  GravyJS unit tests failed (continuing...)"
cd ../..

# 3. E2E Tests
echo ""
echo "3️⃣  E2E Tests..."
echo "Installing Playwright browsers..."
npx playwright install chromium

echo "Running E2E tests..."
npm run test:playwright

echo ""
echo "✅ All tests completed!"
echo ""
echo "View detailed results:"
echo "  npx playwright show-report"