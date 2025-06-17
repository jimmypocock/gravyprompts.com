# Test Coverage Plan for GravyPrompts

## Current Test Coverage Status

### ✅ Already Tested

#### Frontend Components

- `Navigation.tsx` - Admin access, authentication states
- `AdminGuard.tsx` - Access control
- `ApprovalQueue.tsx` - Template approval workflow
- `PermissionsManager.tsx` - User permission management

#### Backend Lambda Functions

- `admin/permissions.js` - Permission CRUD operations
- `admin/approval.js` - Template approval process
- `templates/list.js` - Template listing (integration test)
- Shared auth utilities

#### Infrastructure

- DynamoDB connection testing
- DynamoDB endpoint configuration

### ❌ Missing Test Coverage

#### Frontend Components (Priority: High)

1. **TemplateQuickview.tsx**

   - Variable population
   - Save prompt functionality
   - Share functionality
   - Error handling

2. **AuthGuard.tsx**

   - Redirect logic
   - Loading states
   - Error handling

3. **auth/ProtectedRoute.tsx**

   - Route protection
   - Redirect behavior

4. **AdSense Components** (Priority: Low)

   - AdUnit, AdBanner, AdSidebar, etc.
   - These are mostly wrapper components

5. **GoogleAnalytics.tsx** (Priority: Low)
   - Event tracking
   - Page view tracking

#### Backend Lambda Functions (Priority: High)

1. **templates/create.js**

   - Template validation
   - Moderation flow
   - Error handling
   - Permission checks

2. **templates/update.js**

   - Authorization checks
   - Update validation
   - Moderation re-check

3. **templates/delete.js**

   - Authorization checks
   - Cascade deletion

4. **templates/get.js**

   - Public/private access
   - View tracking
   - Error handling

5. **templates/populate.js**

   - Variable replacement
   - Validation
   - Error handling

6. **templates/share.js**

   - Email sending
   - Token generation
   - Access control

7. **prompts/save.js**

   - User prompt saving
   - Validation
   - Duplicate handling

8. **prompts/list.js**

   - User prompt listing
   - Pagination
   - Filtering

9. **prompts/delete.js**

   - Authorization
   - Deletion logic

10. **moderation/moderate.js**
    - Content filtering
    - Spam detection
    - Approval logic

#### API Integration Tests (Priority: High)

1. **End-to-end Template Flow**

   - Create → Moderate → Approve → Use → Share

2. **Authentication Flow**

   - Login → Access protected resources → Logout

3. **Search Functionality**
   - Search accuracy
   - Performance
   - Edge cases

## Test Implementation Plan

### Phase 1: Critical Path Testing (Week 1)

#### Day 1-2: Template CRUD Operations

```javascript
// templates/create.test.js
- Valid template creation
- Invalid template rejection
- Moderation triggers
- Authorization checks
- Variable extraction

// templates/update.test.js
- Owner can update
- Non-owner cannot update
- Validation rules
- Re-moderation triggers

// templates/delete.test.js
- Owner can delete
- Non-owner cannot delete
- Admin can delete
```

#### Day 3-4: Template Usage

```javascript
// templates/populate.test.js
- Variable replacement
- Missing variables handling
- Invalid template handling
- Performance with large templates

// templates/get.test.js
- Public template access
- Private template restrictions
- View counting
- Non-existent template handling
```

#### Day 5: User Prompts

```javascript
// prompts/save.test.js
- Save populated prompt
- Update existing prompt
- Validation

// prompts/list.test.js
- List user's prompts
- Pagination
- Empty list handling

// prompts/delete.test.js
- Delete own prompt
- Cannot delete others' prompts
```

### Phase 2: Frontend Component Testing (Week 2)

#### Day 1-2: TemplateQuickview

```typescript
// TemplateQuickview.test.tsx
- Render with template data
- Variable input handling
- Copy functionality
- Save prompt
- Share modal
- Loading states
- Error states
```

#### Day 3: Auth Components

```typescript
// AuthGuard.test.tsx
- Authenticated user access
- Unauthenticated redirect
- Loading state

// ProtectedRoute.test.tsx
- Route protection
- Redirect logic
```

#### Day 4-5: Integration Tests

```typescript
// Search flow integration
// Template creation flow
// User journey tests
```

### Phase 3: Edge Cases & Performance (Week 3)

#### Day 1-2: Error Handling

- Network failures
- Invalid data
- Rate limiting
- Concurrent updates

#### Day 3-4: Performance Testing

- Large template handling
- Search performance
- Pagination efficiency
- Concurrent user load

#### Day 5: Security Testing

- SQL injection attempts
- XSS prevention
- CSRF protection
- Authorization bypasses

## Test Standards

### Unit Test Structure

```javascript
describe("ComponentName", () => {
  describe("Feature/Method", () => {
    it("should handle happy path", () => {});
    it("should handle error case", () => {});
    it("should validate input", () => {});
    it("should check authorization", () => {});
  });
});
```

### Coverage Requirements

- Minimum 80% code coverage
- 100% coverage for:
  - Authentication/authorization logic
  - Data validation
  - Error handling
  - Public API methods

### Test Types Required

1. **Unit Tests** - Individual functions/components
2. **Integration Tests** - Component interactions
3. **E2E Tests** - User journeys
4. **Performance Tests** - Load and stress testing
5. **Security Tests** - Vulnerability testing

## Running Tests

### Frontend Tests

```bash
npm test                    # Run all tests
npm test -- --coverage     # With coverage report
npm test ComponentName     # Specific component
```

### Backend Tests

```bash
cd cdk
npm test                   # All backend tests
npm test -- path/to/test  # Specific test
```

### Integration Tests

```bash
npm run test:integration   # Run integration tests
npm run test:e2e          # Run E2E tests
```

## CI/CD Integration

### Pre-commit Hooks

- Run related tests
- Check coverage thresholds
- Lint check

### PR Requirements

- All tests passing
- Coverage maintained/improved
- New features have tests

### Deployment Gate

- Full test suite passes
- Performance benchmarks met
- Security scan passes

## Timeline

- **Week 1**: Critical backend Lambda tests
- **Week 2**: Frontend component tests
- **Week 3**: Integration and edge cases
- **Week 4**: Performance and security testing

Total estimated effort: 4 weeks for comprehensive coverage

## Success Metrics

- 80%+ overall code coverage
- 0 untested public APIs
- All critical paths have E2E tests
- Performance benchmarks established
- Security vulnerabilities addressed
