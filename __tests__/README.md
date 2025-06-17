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

Run with: `npm run test:local`

## Why This Split?

1. **CI Speed**: Only run fast, reliable tests in CI
2. **Dependencies**: Local tests need DynamoDB, AWS SDK, etc.
3. **Reliability**: Many security/E2E tests are aspirational and would fail CI
4. **Cost**: Running full integration tests in CI could incur AWS costs

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
