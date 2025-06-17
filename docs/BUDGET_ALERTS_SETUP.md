# Budget Alerts Setup Guide

This guide explains how to set up AWS budget alerts for GravyPrompts to monitor your costs.

## Quick Setup

1. **Add your email to `.env` file**:

   ```bash
   echo "BUDGET_ALERT_EMAIL=your-email@example.com" >> .env
   ```

2. **Deploy the budget stack**:

   ```bash
   npm run deploy:budget
   ```

3. **Confirm your email subscription**:

   - Check your email inbox
   - Click the confirmation link from AWS SNS
   - This activates your budget alerts

4. **Check current spending**:
   ```bash
   npm run check:budget
   ```

## Budget Configuration

The budget stack creates the following alerts:

### Monthly Budgets

- **Total Budget**: $50/month
  - Alert at 80% ($40)
  - Alert at 100% ($50)

### Service-Specific Budgets

- **Lambda**: $5/month
- **DynamoDB**: $10/month
- **API Gateway**: $5/month
- **CloudWatch**: $5/month
- **S3**: $5/month
- **Amplify**: $10/month

### Daily Anomaly Detection

- Alerts if any single day exceeds $5 in spending

## Customizing Budgets

To change budget amounts, edit `/cdk/src/budget-stack.ts`:

```typescript
// Overall monthly budget
budgetLimit: {
  amount: 50, // Change this value
  unit: "USD",
}

// Service-specific budgets
const services = [
  { name: "Lambda", budget: 5 },      // Change these values
  { name: "DynamoDB", budget: 10 },
  // ...
];
```

After making changes:

```bash
npm run deploy:budget
```

## Viewing Budgets

- **AWS Console**: https://console.aws.amazon.com/billing/home#/budgets
- **Command Line**: `npm run check:budget`

## Removing Budget Alerts

To remove all budget alerts:

```bash
cd cdk
npx cdk destroy GRAVYPROMPTS-Budget
```

## Troubleshooting

### Not receiving alerts?

1. Check spam folder
2. Verify email in AWS SNS console
3. Ensure you clicked the confirmation link

### Wrong email address?

1. Update `.env` file
2. Run `npm run deploy:budget` again
3. Confirm the new email address
