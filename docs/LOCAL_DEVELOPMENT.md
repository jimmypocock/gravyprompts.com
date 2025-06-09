# Local Development Guide

This guide explains how to run and test the template API locally without deploying to AWS.

## Prerequisites

1. **Docker Desktop** - Required for running DynamoDB locally
2. **AWS SAM CLI** - For running Lambda functions locally
   ```bash
   brew install aws-sam-cli  # macOS
   # or
   pip install aws-sam-cli   # Python
   ```
3. **Node.js 20.x** - Same version as Lambda runtime

## Quick Start

### Option 1: Run Everything with One Command (Recommended)

```bash
npm run dev:all
```

This single command will:
- Clean up any existing containers
- Start DynamoDB and LocalStack
- Install dependencies automatically
- Create database tables
- Start the API on http://localhost:7429
- Start Next.js on http://localhost:6827
- Start GravyJS demo on http://localhost:5173

### Option 2: Run Services Individually

If you prefer to run services separately:

```bash
# Terminal 1: Setup and run local services
npm run local:setup    # Start DynamoDB and create tables
npm run local:api      # Start API Gateway

# Terminal 2: Run frontend
npm run dev            # Start Next.js only
```

### Configure Frontend

Make sure your `.env.local` includes:
```env
NEXT_PUBLIC_API_URL=http://localhost:7429
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev:all` | Start everything (recommended) |
| `npm run local:install` | Install local test dependencies |
| `npm run local:setup` | Start DynamoDB and create tables |
| `npm run local:tables` | Create/recreate tables only |
| `npm run local:api` | Start API Gateway only |
| `npm run local:stop` | Stop all Docker containers |
| `npm run local:cleanup` | Clean up everything (containers, ports) |
| `npm run local:test` | Run Lambda function tests |

## Testing Lambda Functions

### Option 1: Using the API

Once the local API is running, you can test endpoints directly:

```bash
# Create a template
curl -X POST http://localhost:7429/templates \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Template",
    "content": "<p>Hello [[name]]!</p>",
    "visibility": "private",
    "tags": ["test"]
  }'

# List templates
curl http://localhost:7429/templates

# Get a specific template
curl http://localhost:7429/templates/{templateId}
```

### Option 2: Direct Lambda Testing

Test individual Lambda functions:

```bash
cd cdk/lambda/templates
IS_LOCAL=true node -e "
  process.env.TEMPLATES_TABLE = 'local-templates';
  process.env.IS_LOCAL = 'true';
  const handler = require('./create').handler;
  const event = {
    body: JSON.stringify({
      title: 'Test',
      content: '<p>Test</p>',
      visibility: 'private'
    }),
    requestContext: {
      authorizer: {
        claims: {
          sub: 'test-user',
          email: 'test@example.com'
        }
      }
    }
  };
  handler(event).then(console.log);
"
```

### Option 3: Using the Test Script

```bash
cd cdk/lambda/templates
node local-test.js
```

## Local Development Features

### DynamoDB Admin UI

View and manage your local DynamoDB tables:
- URL: http://localhost:8001
- See all tables, items, and indexes
- Run queries and scans
- Edit items directly

### Mock Services

The local environment mocks these AWS services:
- **Cognito**: Returns mock user IDs for any email
- **Comprehend**: Always returns safe content (no moderation blocks)
- **Rate Limiting**: Disabled for easier testing

### Debugging

1. **Lambda Logs**: Visible in the terminal running `run-local.sh`
2. **DynamoDB Operations**: Check the DynamoDB Admin UI
3. **Add Console Logs**: They'll appear in the SAM Local output

## Common Issues

### Port Already in Use
```bash
# Kill existing processes
lsof -ti:7429 | xargs kill -9  # API port
lsof -ti:8000 | xargs kill -9  # DynamoDB port
```

### Docker Issues
```bash
# Reset Docker containers
docker-compose down
docker-compose up -d --force-recreate
```

### Lambda Layer Not Found
```bash
# Rebuild the layer
cd cdk/lambda-layers/shared/nodejs
npm install
```

## Testing Workflow

1. **Make Lambda Changes**: Edit files in `cdk/lambda/templates/`
2. **No Restart Needed**: SAM Local reloads automatically
3. **Test via API**: Use curl, Postman, or the frontend
4. **Check Logs**: Watch the SAM Local terminal for errors

## Switching Between Local and AWS

### Local Development
```env
NEXT_PUBLIC_API_URL=http://localhost:7429
```

### AWS Development
```env
NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/development
```

Get your AWS API URL by running:
```bash
npm run deploy:api
```

## Tips

1. **Fast Iteration**: Changes to Lambda code are reflected immediately
2. **Data Persistence**: Local DynamoDB data persists between restarts
3. **Reset Data**: Delete and recreate tables with `setup-local-db.js`
4. **Frontend Auth**: You can bypass auth for local testing by modifying the API client

## Next Steps

Once your local testing is complete:
1. Deploy to AWS: `npm run deploy:api`
2. Update `.env.local` with the AWS API URL
3. Test with real AWS services
4. Deploy to production when ready