# Local Development Guide

This guide explains how to run the GravyPrompts template management system locally.

## Prerequisites

- Docker Desktop installed and running
- AWS SAM CLI installed (`brew install aws-sam-cli`)
- Node.js 20.x or later
- npm or yarn

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   npm run local:install
   ```

2. **Copy environment file**:
   ```bash
   cp .env.local.example .env.local
   ```

3. **Start all services**:
   ```bash
   npm run dev:all
   ```

   This will start:
   - Next.js development server on http://localhost:3000
   - GravyJS demo on http://localhost:5173
   - Local API Gateway on http://localhost:7429
   - DynamoDB Local on http://localhost:8000
   - DynamoDB Admin UI on http://localhost:8001

## Individual Service Commands

### Local API Development

```bash
# Install local dependencies
npm run local:install

# Setup Docker containers and tables
npm run local:setup

# Start API (in separate terminal)
npm run local:start

# View logs
npm run local:logs

# Stop services
npm run local:stop

# Clean up everything
npm run local:cleanup
```

### Testing the API

```bash
# Run API tests
npm run local:test

# View API endpoints
curl http://localhost:7429/templates
```

## Authentication in Local Development

For local development, authentication is mocked:
- All requests with an `Authorization` header will work
- User IDs are automatically generated based on timestamp
- No actual AWS Cognito calls are made

Example request:
```bash
curl -X POST http://localhost:7429/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-dev-token" \
  -d '{
    "title": "My Template",
    "content": "<p>Hello [[name]]!</p>",
    "visibility": "private"
  }'
```

## Troubleshooting

### "Unauthorized" errors

If you get unauthorized errors when saving templates:

1. Run the fix script:
   ```bash
   ./scripts/fix-local-auth.sh
   ```

2. Restart the local API:
   ```bash
   npm run local:stop
   npm run local:start
   ```

### Port conflicts

The following ports are used:
- **3000**: Next.js development server
- **5173**: GravyJS demo
- **7429**: Local API Gateway (SAM)
- **8000**: DynamoDB Local
- **8001**: DynamoDB Admin UI

If you have conflicts, stop the conflicting services or modify the ports in:
- `package.json` (Next.js port)
- `GravyJS/demo/vite.config.js` (GravyJS demo port)
- `cdk/local-test/run-local.sh` (API port)
- `cdk/local-test/docker-compose.yml` (DynamoDB ports)

### Docker issues

If Docker containers won't start:

```bash
# Check running containers
docker ps

# Remove old containers
npm run local:cleanup

# Restart Docker Desktop and try again
npm run local:setup
```

### Lambda layer issues

If Lambda functions can't find dependencies:

```bash
# The fix script will copy necessary files
./scripts/fix-local-auth.sh

# Or manually copy files
cd cdk/local-test
cp -r ../lambda-layers/shared/nodejs/* ../lambda/templates/
```

## Environment Variables

The `.env.local` file should contain:

```env
# API Gateway URL for local development
NEXT_PUBLIC_API_URL=http://localhost:7429

# Mock Cognito values (not used locally but required)
NEXT_PUBLIC_COGNITO_USER_POOL_ID_DEV=local-pool
NEXT_PUBLIC_COGNITO_CLIENT_ID_DEV=local-client
```

## Database Admin

View and manage local DynamoDB tables:
1. Open http://localhost:8001
2. Tables are prefixed with `local-`
3. You can view, add, edit, and delete items

## Architecture

Local development uses:
- **SAM Local**: Emulates API Gateway and Lambda
- **DynamoDB Local**: In-memory database
- **Mock Services**: Cognito and Comprehend are mocked
- **Docker Compose**: Orchestrates local services

## Next Steps

1. Create and test templates through the UI
2. Check API responses with `npm run local:test`
3. View database changes at http://localhost:8001
4. Make code changes - hot reload is enabled