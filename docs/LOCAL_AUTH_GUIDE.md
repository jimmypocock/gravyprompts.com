# Local Authentication Setup for GravyPrompts

This document explains how local authentication works and how to troubleshoot common issues.

## How Local Authentication Works

In local development, we bypass AWS Cognito authentication and use mock authentication instead:

1. **Frontend**: Sends `Authorization: Bearer local-dev-token` header
2. **API Gateway**: Passes the request to Lambda functions
3. **Lambda Functions**: Check `IS_LOCAL` environment variable
4. **Mock Auth**: Returns `local-test-user` as the user ID

## Key Files

### `/cdk/lambda/templates/utils.js`

The main utilities file that handles authentication. In local mode:

- Checks `IS_LOCAL` or `AWS_SAM_LOCAL` environment variables
- Returns mock user ID for any request with Authorization header
- Configures DynamoDB to use local Docker instance
- Provides mock AWS services (Comprehend, Cognito)

### `/cdk/lambda/templates/utils-local.js`

The source file for local development utilities. This file is copied to `utils.js` during local setup.

### `/cdk/local-test/run-local.sh`

The main script that:

1. Starts Docker containers
2. Creates DynamoDB tables
3. Copies Lambda layer dependencies
4. **Ensures utils-local.js is used as utils.js**
5. Creates env.json with local environment variables
6. Starts SAM Local with proper configuration

### `/cdk/local-test/env.json`

Contains environment variables for all Lambda functions:

```json
{
  "CreateTemplateFunction": {
    "IS_LOCAL": "true",
    "AWS_SAM_LOCAL": "true",
    "TEMPLATES_TABLE": "local-templates",
    "ENVIRONMENT": "development"
  }
  // ... similar for other functions
}
```

## Common Issues and Solutions

### Issue: "Unauthorized" Error (401)

**Symptoms:**

- API returns `{"error": "Unauthorized"}`
- Debug logs show `User ID: null`

**Cause:**
The `utils.js` file has been overwritten with the production version.

**Solution:**

```bash
# Fix the authentication setup
npm run local:fix-auth

# Restart SAM Local (IMPORTANT!)
# Press Ctrl+C to stop current instance
npm run local:start

# Test the API
npm run local:test
```

### Issue: "Cannot find module '/opt/nodejs/utils'"

**Symptoms:**

- Lambda functions fail to start
- Error about missing module

**Cause:**
Lambda functions are trying to import from Lambda layer path instead of local path.

**Solution:**
The import statements in Lambda functions should use:

```javascript
const utils = require("./utils");
```

### Issue: DynamoDB Connection Errors

**Symptoms:**

- "Could not connect to DynamoDB"
- Timeout errors

**Cause:**
Docker containers not running or wrong endpoint configuration.

**Solution:**

```bash
# Check Docker containers
docker ps | grep gravyprompts

# Restart everything
npm run local:stop
npm run local:setup
npm run local:start
```

## Testing

### 1. Test Authentication Setup

```bash
npm run local:test:auth
```

This checks:

- utils.js has local authentication logic
- Environment variables are set
- env.json exists

### 2. Test API Endpoints

```bash
npm run local:test:api
```

This tests:

- Create, Read, Update, Delete operations
- Template population
- Sharing functionality
- List filters

### 3. Quick Test

```bash
npm run local:test
```

Simple test that creates a template and verifies basic operations.

## Development Workflow

1. **Start Services:**

   ```bash
   npm run dev:all
   ```

2. **If Authentication Fails:**

   ```bash
   # In a new terminal
   npm run local:fix-auth

   # Then restart SAM Local
   # Go to the terminal running local:start
   # Press Ctrl+C
   # Run: npm run local:start
   ```

3. **Monitor Logs:**
   - SAM Local logs: Check the terminal running `local:start`
   - DynamoDB logs: `npm run local:logs`
   - Frontend logs: Browser console

## How the Fix Works

The `local:fix-auth` script:

1. Copies `utils-local.js` to `utils.js`
2. Verifies the file has local authentication logic
3. Updates env.json if needed

The key difference between production and local `utils.js`:

**Production Version:**

```javascript
const getUserIdFromEvent = (event) => {
  if (event.requestContext?.authorizer?.claims?.sub) {
    return event.requestContext.authorizer.claims.sub;
  }
  return null; // Returns null = Unauthorized
};
```

**Local Version:**

```javascript
const getUserIdFromEvent = (event) => {
  if (isLocal) {
    return "local-test-user"; // Always returns a user ID
  }
  // ... production logic
};
```

## Environment Variables

The following must be set for local authentication to work:

- `IS_LOCAL=true` - Primary flag for local mode
- `AWS_SAM_LOCAL=true` - Backup flag set by SAM

These are configured in:

1. `env.json` - For Lambda functions
2. `run-local.sh` - Export statements before starting SAM

## Preventing Future Issues

1. **Never manually copy production utils.js**
2. **Always use npm scripts** instead of manual commands
3. **If modifying Lambda layer**, update `utils-local.js` not `utils.js`
4. **After any file changes**, run `npm run local:fix-auth`

## Architecture Diagram

```
Frontend (localhost:3000)
    |
    | Authorization: Bearer local-dev-token
    ↓
API Gateway (localhost:7429)
    |
    ↓
Lambda Function
    |
    ├─→ Check IS_LOCAL env var
    |     |
    |     ├─→ YES: Return 'local-test-user'
    |     └─→ NO: Check Cognito authorizer
    |
    ↓
DynamoDB Local (localhost:8000)
```

## Summary

Local authentication works by:

1. Detecting local environment via `IS_LOCAL` variable
2. Returning a mock user ID instead of validating tokens
3. Using local DynamoDB instead of AWS DynamoDB
4. Mocking AWS services (Comprehend, Cognito)

The most common issue is `utils.js` being overwritten with the production version. Always use `npm run local:fix-auth` to restore the local version.
