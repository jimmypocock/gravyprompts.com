# Authentication Fixes Documentation

## Overview
This document details the authentication fixes implemented to resolve session management issues between the frontend and backend, particularly for local development with SAM Local.

## Issues Resolved

### 1. Template Operations Returning "Session Expired"
**Problem**: When creating, updating, or deleting templates, users received "Session expired" errors despite being logged in.

**Root Cause**: Template Lambda functions were using `getUserIdFromEvent`, which only extracted the user ID without proper SAM Local authentication handling.

**Solution**: Updated all template Lambda functions to use `getUserFromEvent` from the shared auth layer:
- `/cdk/lambda/templates/create.js`
- `/cdk/lambda/templates/update.js`
- `/cdk/lambda/templates/delete.js`
- `/cdk/lambda/templates/get.js`
- `/cdk/lambda/templates/list.js`

**Code Changes**:
```javascript
// Before
const { getUserIdFromEvent } = require('/opt/nodejs/utils');
const userId = getUserIdFromEvent(event);

// After
const { getUserFromEvent } = require('/opt/nodejs/auth');
const user = await getUserFromEvent(event);
const userId = user ? user.sub : null;
```

### 2. Admin Endpoint 500 Errors
**Problem**: Admin endpoints (`/admin/permissions` and `/admin/approval/history`) returned 500 errors due to DynamoDB query issues.

**Root Cause**: Using `QueryCommand` without proper key conditions when filtering wasn't provided.

**Solution**: Updated admin Lambda functions to use `ScanCommand` when no specific query keys are provided:
- `/cdk/lambda/admin/permissions.js`
- `/cdk/lambda/admin/approval.js`

**Code Changes**:
```javascript
// Added ScanCommand import
const { QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');

// Use appropriate command based on parameters
const response = await docClient.send(
  hasKeyCondition ? new QueryCommand(params) : new ScanCommand(params)
);
```

### 3. UserUnAuthenticatedException Console Errors
**Problem**: Expected authentication errors were cluttering the console when users weren't logged in.

**Root Cause**: Error logging didn't differentiate between expected and unexpected authentication failures.

**Solution**: Updated error handling in `/lib/auth-context.tsx` to suppress expected errors:

```javascript
} catch (error: any) {
  // UserUnAuthenticatedException is expected when user is not logged in
  if (error?.name !== 'UserUnAuthenticatedException') {
    console.error('Error loading user:', error);
  }
  // User is not authenticated
  setUser(null);
  // Clear session cache on auth failure
  sessionCacheRef.current = null;
}
```

### 4. Missing Environment Variables
**Problem**: API proxy was failing due to missing `SAM_LOCAL_URL` environment variable.

**Solution**: Added required environment variables to `.env.local`:
```env
SAM_LOCAL_URL=http://localhost:7429
LOCAL_ADMIN_USER_ID=<your-local-user-id>
LOCAL_ADMIN_EMAIL=<your-email>
```

## Authentication Flow

### Local Development
1. Frontend uses Cognito for authentication (production User Pool)
2. API requests go through Next.js proxy (`/api/proxy/*`)
3. Proxy forwards requests to SAM Local with mock Authorization header
4. SAM Local Lambda functions use `getUserFromEvent` which:
   - In production: Extracts user from JWT token
   - In local: Returns mock user based on `LOCAL_ADMIN_USER_ID`

### Production
1. Frontend uses Cognito for authentication
2. API requests include JWT token in Authorization header
3. API Gateway validates JWT token
4. Lambda functions extract user details from validated token

## Key Components

### `/cdk/lambda/layers/nodejs/auth.js`
Central authentication module that handles both production JWT validation and local development mock auth.

### `/lib/api/templates.ts` & `/lib/api/admin.ts`
API client modules that automatically route to proxy for local development:
```typescript
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '/api/proxy';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'https://api.gravyprompts.com';
};
```

### `/app/api/proxy/[...path]/route.ts`
Next.js API route that proxies requests to SAM Local with mock authentication headers.

## Testing

All authentication flows have been tested with:
- Frontend component tests (37 passing)
- Backend integration tests (30 passing)
- Manual testing of:
  - Template CRUD operations
  - Admin permissions management
  - Approval workflow
  - Session management

## Best Practices

1. **Always use `getUserFromEvent`** in Lambda functions for consistent auth handling
2. **Check for null user** when authentication is optional (e.g., public template viewing)
3. **Use proper async/await** when calling `getUserFromEvent` as it may perform async operations
4. **Clear session cache** on authentication failures to prevent stale data
5. **Suppress expected errors** to keep console logs clean and useful

## Troubleshooting

### "Session expired" errors
1. Verify `getUserFromEvent` is being used (not `getUserIdFromEvent`)
2. Check that the function properly awaits the auth call
3. Ensure proper error handling for unauthorized access

### 500 errors on admin endpoints
1. Check if using QueryCommand without proper key conditions
2. Verify ScanCommand is used for list operations without filters
3. Check DynamoDB table names match environment (local vs production)

### Authentication not working locally
1. Verify `LOCAL_ADMIN_USER_ID` is set in `.env.local` with your Cognito user ID
2. Ensure SAM Local is running (`npm run local:start`)
3. Check that API proxy is correctly configured
4. Verify local permissions table has admin permissions for the user
5. Run `npm run scripts:local:setup-admin-permissions` to set up admin access