# Authentication Setup

## Overview

GravyPrompts uses a single shared Cognito User Pool for both local development and production environments. This simplifies management while still allowing proper auth testing.

## Environment Variables

Add these to both `.env.local` (for local development) and Amplify environment variables (for production):

```env
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<your-user-pool-id>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<your-client-id>
```

## Deployment

Deploy the auth stack:
```bash
npm run deploy:auth
```

This will output the User Pool ID and Client ID that you need to set in your environment variables.

## Local Development

### With Real Authentication (default)
- Uses the shared Cognito User Pool
- Real sign up/sign in flow
- Useful for testing auth features

### With Mocked Authentication
- The local SAM API always returns `local-user-123` as the user ID
- No actual JWT validation happens
- Useful for rapid feature development

## Production

- Uses the same Cognito User Pool as development
- Real JWT validation on all API endpoints
- Proper authorization checks

## Stack Names

- **Auth**: `GRAVYPROMPTS-Auth`
- **API**: `GRAVYPROMPTS-API` 
- **WAF**: `GRAVYPROMPTS-WAF`

All stacks follow the same naming convention without environment suffixes.

## Troubleshooting

### Domain Already Exists Error

If you get "Domain already associated with another user pool" error:

1. This usually means an old stack is using the Cognito domain
2. Delete the old stack from AWS Console
3. Wait for deletion to complete before redeploying

### Stack Recovery

If deployments fail:

1. Delete the problematic stack from AWS Console
2. Wait for deletion to complete
3. Redeploy with `npm run deploy:auth` or `npm run deploy:api`

### Validation

Check your auth setup:
```bash
npm run check:auth
```