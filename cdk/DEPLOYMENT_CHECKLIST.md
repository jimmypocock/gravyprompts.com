# Deployment Verification Checklist

## Local Development Testing

### 1. Start Fresh
```bash
npm run local:cleanup
npm run dev:all
```

### 2. Verify Services Running
- [ ] Docker containers started (check `docker ps`)
- [ ] DynamoDB Admin UI accessible at http://localhost:8001
- [ ] SAM Local API running at http://localhost:7429
- [ ] Next.js app running at http://localhost:6827

### 3. Load Test Data
```bash
npm run templates:load:local -- --file ./data/consolidated-templates.json
```

### 4. Test API Endpoints
```bash
# List templates (should return data)
curl http://localhost:7429/templates

# Get specific template
curl http://localhost:7429/templates/[TEMPLATE_ID]

# Test search
curl "http://localhost:7429/templates?search=test"
```

### 5. Test Frontend
- [ ] Visit http://localhost:6827
- [ ] Templates display correctly
- [ ] Search functionality works
- [ ] Template quickview panel opens
- [ ] Can populate template variables

## Production Deployment

### 1. Pre-deployment Checks
```bash
npm run lint
npm run build:all
```

### 2. Deploy Backend
```bash
# Deploy API stack (includes Lambda, DynamoDB, API Gateway)
npm run deploy:api

# Check deployment status
npm run status:all
```

### 3. Verify Deployment
```bash
# Check API Gateway endpoint
npm run check:api

# Test production API
npm run test:api:production
```

### 4. Frontend Deployment
```bash
# Push to GitHub - Amplify auto-deploys
git push origin main

# Check Amplify deployment
npm run check:amplify:app
```

### 5. Post-deployment Verification
- [ ] Visit production site
- [ ] Test template listing
- [ ] Test search functionality
- [ ] Test authentication (login/signup)
- [ ] Create a test template
- [ ] Save a populated prompt

## Troubleshooting

### If Lambda Functions Return 502
1. Check CloudWatch logs:
   ```bash
   npm run check:lambda:logs
   ```

2. Common causes:
   - Module not found errors → Check Lambda layer deployment
   - Timeout errors → Increase Lambda timeout
   - Permission errors → Check IAM role permissions

### If Frontend Can't Connect to API
1. Check CORS configuration
2. Verify API URL in `.env.local`
3. Check browser console for errors

### If Search Returns No Results
1. Verify templates exist in DynamoDB
2. Check moderation status (should be 'approved')
3. Test with simple search terms