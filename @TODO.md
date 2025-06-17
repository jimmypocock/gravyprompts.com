# TODO - Test Coverage

## 🚨 CRITICAL SECURITY FIXES (Do First!)

- [ ] **Fix Rate Limiting** - `checkRateLimit` function returns true without any implementation
- [ ] **Disable Anonymous View Tracking** - Every view creates DynamoDB records (cost risk!)
- [ ] **Add IP Rate Limiting** - Public endpoints have no protection against abuse
- [ ] **Reduce Response Sizes** - Don't return full content in list responses
- [ ] **Deploy WAF** - Run `npm run deploy:waf` if not already deployed
- [ ] **Set up AWS Billing Alerts** - Protect against unexpected costs

See `/URGENT_SECURITY_FIXES.md` for implementation details.

## High Priority

### Backend Tests

- [ ] **Template CRUD Operations** - Add tests for create, update, delete endpoints in `/cdk/lambda/templates/`
- [ ] **Fix Search Bug** - Popularity boost prevents empty results (found in search integration tests)

### Frontend Tests (Medium Priority)

- [ ] **User Prompts Functionality** - Tests for save, list, delete user prompts
- [ ] **TemplateQuickview Component** - Test variable population, copy functionality, save to account
- [ ] **SearchBar Component** - Test search input, debouncing, context integration
- [ ] **Navigation Component** - Test scroll behavior, search integration, auth state

## Medium Priority

### E2E Testing Setup

- [ ] **Set up Playwright or Cypress** - Choose and configure E2E testing framework
- [ ] **Create E2E test suite** covering:
  - Search flow (type query → see results → click template → view quickview)
  - Template approval workflow (admin login → approve → verify in search)
  - User prompt saving (populate template → save → view in account)

## Low Priority

### Additional Coverage

- [ ] **API proxy tests** - Test CORS proxy functionality in `/app/api/proxy/`
- [ ] **Error boundary tests** - Test error handling and fallback UI
- [ ] **Performance tests** - Test search performance with large datasets

## Completed ✅

### Backend

- ✅ Jest testing framework setup
- ✅ Auth module unit tests
- ✅ Admin endpoints integration tests
- ✅ Search algorithm comprehensive test suite (18 scenarios)
- ✅ E2E tests for admin/approval flow

### Frontend

- ✅ React Testing Library setup
- ✅ AdminGuard component tests (7 tests)
- ✅ ApprovalQueue component tests (13 tests)
- ✅ PermissionsManager component tests (17 tests)

## Test Coverage Summary

Current test coverage includes:

- **Backend**: Auth, admin permissions, approval process, search functionality
- **Frontend**: Critical admin components with full interaction testing
- **Integration**: Real DynamoDB testing, no mocks for integration tests

Missing coverage:

- Template CRUD operations
- User prompts functionality
- Non-admin frontend components
- True browser-based E2E tests
