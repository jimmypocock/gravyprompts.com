# Local Development Guide

This guide explains how to run the GravyPrompts template management system locally.

## Prerequisites

- Docker Desktop installed and running
- AWS SAM CLI installed (`brew install aws-sam-cli`)
- Node.js 20.x or later
- npm

## Quick Start

**IMPORTANT: Use only `npm run dev:all` for local development.**

```bash
# Install dependencies
npm install

# Start everything with one command
npm run dev:all
```

This single command will:

1. Clean up any existing Docker containers
2. Start DynamoDB Local on port 8000
3. Create all necessary database tables
4. **Load sample template data automatically**
5. Start SAM Local API Gateway on port 7429
6. Start Next.js development server on port 6827
7. Start GravyJS demo on port 5173
8. Make DynamoDB Admin UI available on port 8001

## Access Points

- **Main Application**: http://localhost:6827
- **API Gateway**: http://localhost:7429
- **DynamoDB Admin**: http://localhost:8001
- **GravyJS Demo**: http://localhost:5173

## What's Included

When you run `npm run dev:all`, you get:

- 10 sample templates pre-loaded with various categories
- Full API functionality with mocked authentication
- Hot reload for all code changes
- Database persistence until containers are stopped

## Stopping Services

Press `Ctrl+C` in the terminal where you ran `npm run dev:all`. This will stop all services gracefully.

## Troubleshooting

### Templates not loading?

Templates are automatically loaded when starting with `npm run dev:all`. If you need to reload them:

```bash
npm run templates:load:local -- --file ./data/sample-templates.json
```

### Port conflicts

The following ports are used:

- **6827**: Next.js application
- **7429**: API Gateway
- **8000**: DynamoDB
- **8001**: DynamoDB Admin UI
- **5173**: GravyJS Demo

### Docker issues

If containers won't start:

```bash
# Stop everything and clean up
docker-compose -f cdk/local-test/docker-compose.yml down -v

# Then restart
npm run dev:all
```

## Authentication in Local Development

Authentication is mocked for local development:

- Any `Authorization` header will work
- User IDs are automatically generated
- No actual AWS Cognito calls are made

## Do NOT Use Individual Commands

For consistency and to avoid confusion, always use `npm run dev:all`. Individual service commands (`npm run dev`, `npm run local:start`, etc.) should not be used directly.
