# Test Organization

## Test Categories

### ✅ CI Tests (Run in GitHub Actions)

These tests run automatically on every push and PR:

- **Component Tests** (`components/__tests__/`) - UI component tests
- **Contract Tests** (`__tests__/contracts/`) - API contract validation
- **Dummy Tests** (`__tests__/dummy.test.js`) - Basic sanity check
- **Placeholder Tests** (`__tests__/components/`, `__tests__/lambda/`) - CI path compatibility

Run with: `npm run test:ci`

### 🏠 Local-Only Tests

These tests require local setup and should NOT run in CI:

- **Security Tests** (`__tests__/security/`) - Test security features, many unimplemented
- **E2E Tests** (`__tests__/e2e/`) - Full user flow tests, need complete app setup
- **Integration Tests** (`__tests__/integration/`) - Test API integrations
- **Lambda Tests** (`cdk/lambda/__tests__/`) - Require DynamoDB and AWS services

Run with: 
```bash
npm run test:local      # All local tests
npm run test:e2e        # E2E tests only
```

## Why This Split?

1. **CI Speed**: Only run fast, reliable tests in CI
2. **Dependencies**: Local tests need DynamoDB, AWS SDK, etc.
3. **Reliability**: E2E tests can be flaky in CI environments due to timing issues and mock limitations
4. **Cost**: Running full integration tests in CI could incur AWS costs
5. **Environment**: E2E tests work best with a fully running local development environment

## Commands

```bash
# Run only CI-friendly tests
npm run test:ci

# Run only local tests
npm run test:local

# Run all tests (CI + local)
npm test

# Run specific test suites
npm test -- components/__tests__  # Component tests only
npm test -- __tests__/security    # Security tests only
```

## Adding New Tests

- **Quick unit tests**: Add to appropriate CI directory
- **Tests needing AWS/DB**: Add to local-only directories
- **Not sure?**: Start in local-only, move to CI once stable
