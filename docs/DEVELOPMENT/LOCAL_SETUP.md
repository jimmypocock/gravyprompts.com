# Local Development Setup

This guide explains how to run the GravyPrompts application locally for development.

## Prerequisites

- **Docker Desktop** - Required for DynamoDB Local
- **AWS SAM CLI** - For running Lambda functions locally
  ```bash
  brew install aws-sam-cli  # macOS
  pip install aws-sam-cli   # Python
  ```
- **Node.js 20.x** - Same version as Lambda runtime
- **npm** - For package management

## Quick Start

### Recommended: One Command Setup

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
4. Load sample template data automatically
5. Start SAM Local API Gateway on port 7429
6. Start Next.js development server on port 6827
7. Start GravyJS demo on port 5173
8. Make DynamoDB Admin UI available on port 8001

## Access Points

- **Main Application**: http://localhost:6827
- **API Gateway**: http://localhost:7429
- **DynamoDB Admin**: http://localhost:8001
- **GravyJS Demo**: http://localhost:5173

## Environment Configuration

Create a `.env.local` file in the project root:

```env
# Local API endpoint
NEXT_PUBLIC_API_URL=http://localhost:7429

# Optional: Google Analytics and AdSense
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_ADSENSE_CLIENT_ID=ca-pub-XXXXXXXXXXXXXXXXX
```

## Authentication in Local Development

Local development uses mock authentication:

- Any `Authorization` header will work
- User IDs are automatically generated as `local-user-{timestamp}`
- No actual AWS Cognito calls are made
- Rate limiting is disabled for easier testing

## Local Services Architecture

### Mock Services

- **Cognito**: Returns mock user IDs for any authorization header
- **Comprehend**: Always returns safe content (no moderation blocks)
- **DynamoDB**: Local Docker container with persistent data

### Port Usage

- **6827**: Next.js application
- **7429**: API Gateway (SAM Local)
- **8000**: DynamoDB Local
- **8001**: DynamoDB Admin UI
- **5173**: GravyJS Demo

## Development Workflow

### 1. Making Code Changes

**Frontend Changes** (React/Next.js):

- Edit files in `app/`, `components/`, or `lib/`
- Changes hot-reload automatically
- No restart needed

**Lambda Function Changes**:

- Edit files in `cdk/lambda/templates/`
- SAM Local reloads automatically
- Test immediately via API calls

**Infrastructure Changes** (CDK):

- Edit files in `cdk/src/`
- Run `npm run build:cdk` to compile
- Deploy with appropriate deploy command

### 2. Testing Your Changes

**API Testing**:

```bash
# Create a template
curl -X POST http://localhost:7429/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "title": "Test Template",
    "content": "<p>Hello [[name]]!</p>",
    "visibility": "private",
    "tags": ["test"]
  }'

# List templates
curl http://localhost:7429/templates \
  -H "Authorization: Bearer test-token"

# Run full API test suite
npm run local:test:api
```

**Frontend Testing**:

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### 3. Database Management

**View Data**:

- Open http://localhost:8001 for DynamoDB Admin UI
- Browse tables, items, and run queries

**Load Sample Data**:

```bash
npm run templates:load:local -- --file ./data/sample-templates.json
```

**Clear All Data**:

```bash
npm run local:clear:all
```

## Troubleshooting

### Common Issues

**Templates not loading?**

```bash
# Reload sample templates
npm run templates:load:local -- --file ./data/consolidated-templates.json
```

**Port conflicts?**

```bash
# Clean up all services
npm run local:cleanup

# Then restart
npm run dev:all
```

**Authentication errors?**

```bash
# Fix local auth setup
npm run local:fix-auth

# Restart services
npm run dev:all
```

**Docker issues?**

```bash
# Reset Docker containers
docker-compose -f cdk/local-test/docker-compose.yml down -v

# Restart Docker Desktop if needed
```

### Debugging Tips

1. **Lambda Logs**: Watch the terminal running `npm run dev:all`
2. **Network Requests**: Use browser DevTools Network tab
3. **Database State**: Check DynamoDB Admin UI
4. **Add Debug Logs**:
   ```javascript
   console.log("Debug:", variable);
   ```

### Environment Variables

Local Lambda functions have access to:

- `IS_LOCAL=true` - Triggers local auth mode
- `TEMPLATES_TABLE=local-templates`
- `TEMPLATE_VIEWS_TABLE=local-template-views`
- `USER_PROMPTS_TABLE=local-user-prompts`
- `USER_PERMISSIONS_TABLE=local-user-permissions`

## Advanced Usage

### Running Services Individually

If you need more control, run services separately:

```bash
# Terminal 1: Infrastructure
npm run local:setup    # Start DynamoDB
npm run local:api      # Start API Gateway

# Terminal 2: Frontend
npm run start:next     # Next.js only

# Terminal 3: GravyJS Demo
npm run demo:dev       # GravyJS demo
```

### Direct Lambda Testing

Test Lambda functions without the API:

```bash
cd cdk/lambda/templates
IS_LOCAL=true node local-test.js
```

### Switching to AWS Backend

To test against real AWS services:

1. Deploy your backend:

   ```bash
   npm run deploy:backend
   ```

2. Update `.env.local`:

   ```env
   NEXT_PUBLIC_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/production
   NEXT_PUBLIC_USER_POOL_ID=us-east-1_XXXXXXXXX
   NEXT_PUBLIC_USER_POOL_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
   ```

3. Restart Next.js to load new environment variables

## Best Practices

1. **Always use `npm run dev:all`** for consistency
2. **Check logs** when debugging issues
3. **Use DynamoDB Admin UI** to verify data changes
4. **Test both frontend and API** after changes
5. **Commit `.env.example`** but never `.env.local`

## Data Persistence

- DynamoDB data persists between restarts (stored in Docker volumes)
- To start fresh, run `npm run local:cleanup` before `npm run dev:all`
- Templates are automatically loaded on first start
- User data and permissions are preserved

## Next Steps

Once local development is working:

1. Write tests for your changes
2. Run `npm run lint` to check code style
3. Run `npm run type-check` for TypeScript validation
4. Create a pull request with your changes
5. Deploy to staging for integration testing
