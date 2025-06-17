# Production Standards for GravyPrompts

This document defines the production-ready standards that must be followed for all code changes in this project.

## Core Principles

### 1. Security First

- **NEVER** put secrets, API keys, or sensitive data in client-side code
- **NEVER** implement authentication/authorization logic on the client
- **ALWAYS** validate permissions server-side
- **ALWAYS** use environment variables for configuration, never hardcode

### 2. No Development Shortcuts in Production Code

- **NEVER** use hardcoded IDs, emails, or user data in components
- **NEVER** bypass security checks based on hostname or environment
- **ALWAYS** use feature flags or environment variables for dev-only features
- **ALWAYS** ensure dev conveniences are server-side only

### 3. Error Handling & Resilience

- **ALWAYS** handle API failures gracefully
- **ALWAYS** provide fallback behavior for network issues
- **NEVER** expose internal error details to users
- **ALWAYS** log errors appropriately for debugging

### 4. Performance & Scalability

- **AVOID** unnecessary API calls
- **IMPLEMENT** proper caching strategies
- **USE** pagination for large data sets
- **OPTIMIZE** bundle sizes and lazy load when appropriate

### 5. Testing Requirements

- **ALWAYS** write tests for new features
- **ALWAYS** update tests when changing functionality
- **ENSURE** tests reflect production behavior, not dev shortcuts
- **RUN** tests before committing changes

## Code Review Checklist

Before implementing any solution, verify:

- [ ] No hardcoded values that should be configurable
- [ ] No client-side security decisions
- [ ] Proper error handling in place
- [ ] Tests written and passing
- [ ] No console.log statements in production code
- [ ] Environment-specific code is properly isolated
- [ ] API endpoints are properly authenticated
- [ ] Sensitive operations have server-side validation

## Common Anti-Patterns to Avoid

### ❌ BAD: Client-side permission check

```typescript
// NEVER DO THIS
if (user.userId === "admin-123" || user.role === "admin") {
  showAdminFeatures();
}
```

### ✅ GOOD: Server-side permission check

```typescript
// Always verify through API
const isAdmin = await checkAdminAccess(); // Server validates
if (isAdmin) {
  showAdminFeatures();
}
```

### ❌ BAD: Hardcoded configuration

```typescript
// NEVER DO THIS
const API_URL = "https://api.gravyprompts.com";
const ADMIN_EMAIL = "admin@gravyprompts.com";
```

### ✅ GOOD: Environment-based configuration

```typescript
// Use environment variables
const API_URL = process.env.NEXT_PUBLIC_API_URL;
// Admin email should be server-side only
```

### ❌ BAD: Dev shortcuts in components

```typescript
// NEVER DO THIS
if (window.location.hostname === 'localhost') {
  return <AdminPanel />; // Bypassing auth
}
```

### ✅ GOOD: Consistent behavior across environments

```typescript
// Same flow for all environments
const hasAccess = await checkPermissions();
if (hasAccess) {
  return <AdminPanel />;
}
```

## Environment-Specific Code

When you need different behavior for local development:

1. **Prefer server-side switches** using environment variables
2. **Use feature flags** that can be toggled without code changes
3. **Isolate dev tools** to separate modules that aren't included in production builds
4. **Document clearly** why the difference exists

## Deployment Readiness

Before any code is considered complete:

1. **Security audit**: Could a malicious user bypass any checks?
2. **Performance check**: Will this scale to thousands of users?
3. **Error scenarios**: What happens when things fail?
4. **Monitoring**: Can we debug issues in production?
5. **Documentation**: Will another developer understand this in 6 months?

## For AI Assistants (Claude, etc.)

When providing code solutions:

1. **ALWAYS** consider production deployment from the start
2. **NEVER** suggest client-side shortcuts for authentication/authorization
3. **ALWAYS** implement proper error handling
4. **WARN** explicitly if suggesting temporary solutions
5. **DEFAULT** to secure, scalable solutions even if they're more complex

If a quick solution is needed for development:

- Clearly mark it as "DEVELOPMENT ONLY"
- Provide the production-ready alternative
- Add TODO comments for required changes

## Red Flags to Watch For

- Hardcoded IDs, emails, or secrets
- Client-side permission checks
- Missing error handling
- No tests for new features
- Console.log in production code
- Assumptions about environment
- Bypassing established patterns
- "Quick fixes" that compromise security

Remember: **It's better to take extra time to build it right than to create security vulnerabilities or technical debt.**
