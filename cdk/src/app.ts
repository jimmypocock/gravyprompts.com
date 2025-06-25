#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();
import { CertificateStack } from "./certificate-stack";
import { WafStack } from "./waf-stack";
import { ApiWafStack } from "./api-waf-stack";
import { MonitoringStackAmplify } from "./monitoring-stack-amplify";
import { AuthStack } from "./auth-stack";
import { ApiStack } from "./api-stack";
import { BudgetStack } from "./budget-stack";
import { ComprehensiveMonitoringStack } from "./comprehensive-monitoring-stack";
import { CacheStack } from "./cache-stack";

const app = new cdk.App();

// Configuration - Get from environment variables or CDK context
const domainName =
  process.env.DOMAIN_NAME ||
  app.node.tryGetContext("domainName") ||
  "example.com";
const appName =
  process.env.APP_NAME || app.node.tryGetContext("appName") || "nextjs-app";
const stackPrefix =
  process.env.STACK_PREFIX ||
  app.node.tryGetContext("stackPrefix") ||
  appName.toUpperCase().replace(/[^A-Z0-9]/g, "");
const certificateArn =
  process.env.CERTIFICATE_ARN || app.node.tryGetContext("certificateArn");
const notificationEmail = app.node.tryGetContext("notificationEmail");

// Common environment for us-east-1 (required for ACM and WAF)
const usEast1Env = {
  region: "us-east-1",
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

// Get environment (development or production)
const environment = (process.env.ENVIRONMENT || "development") as
  | "development"
  | "production";

// 1. Certificate Stack - ACM certificate management (optional, can be reused by Amplify)
// Only create certificate stack if explicitly requested via context
// Never create it when we already have a certificate ARN (to avoid deletion)
if (app.node.tryGetContext("createCertificate") === "true") {
  new CertificateStack(app, `${stackPrefix}-Certificate`, {
    domainName: domainName,
    certificateArn: certificateArn,
    env: usEast1Env,
    description: `SSL/TLS certificate for ${appName}`,
  });
}

// 2. WAF Stack - Web Application Firewall (can be attached to Amplify)
new WafStack(app, `${stackPrefix}-WAF`, {
  env: usEast1Env,
  description: `WAF rules for ${appName}`,
});

// 3. Auth Stack - Cognito User Pool and Authentication (shared between environments)
const authStack = new AuthStack(app, `${stackPrefix}-Auth`, {
  appName: appName,
  domainName: domainName,
  environment: environment,
  env: usEast1Env,
  description: `Authentication (Cognito) for ${appName} - ${environment}`,
});

// 4. API Stack - REST API with Lambda and DynamoDB
// Note: The API stack will use the auth stack based on the current environment
// In development, the API is run locally with SAM, so this stack is only deployed for production
const apiStack = new ApiStack(app, `${stackPrefix}-API`, {
  appName: appName,
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  env: usEast1Env,
  description: `API and database for ${appName} - Production`,
});

// API stack depends on auth stack
apiStack.addDependency(authStack);

// 4a. API WAF Stack - WAF for API Gateway (Regional)
const apiWafStack = new ApiWafStack(app, `${stackPrefix}-API-WAF`, {
  api: apiStack.api,
  env: usEast1Env,
  description: `WAF rules for ${appName} API Gateway`,
});

// API WAF depends on API stack
apiWafStack.addDependency(apiStack);

// 5. Cache Stack - CloudFront CDN for API caching
const cacheStack = new CacheStack(app, `${stackPrefix}-Cache`, {
  api: apiStack.api,
  env: usEast1Env,
  description: `CloudFront CDN caching for ${appName} API`,
});

// Cache stack depends on API stack
cacheStack.addDependency(apiStack);

// 6. Monitoring Stack for Amplify
// Only create if explicitly requested for Amplify deployments
if (
  app.node.tryGetContext("amplifyMonitoring") === "true" ||
  notificationEmail
) {
  const monitoringStackAmplify = new MonitoringStackAmplify(
    app,
    `${stackPrefix}-Monitoring-Amplify`,
    {
      emailAddress: notificationEmail,
      apiGatewayName: apiStack.api.restApiName,
      env: usEast1Env,
      description: `Monitoring and alerting for ${appName} (Amplify)`,
    },
  );

  // Monitoring depends on API stack to get the API name
  monitoringStackAmplify.addDependency(apiStack);
}

// 6. Budget Stack - Cost alerts and monitoring
// Always create budget stack to monitor costs
new BudgetStack(app, `${stackPrefix}-Budget`, {
  env: usEast1Env,
  description: `Cost monitoring and budget alerts for ${appName}`,
});

// 7. Comprehensive Monitoring Dashboard
const monitoringDashboard = new ComprehensiveMonitoringStack(
  app,
  `${stackPrefix}-Dashboard`,
  {
    emailAddress: notificationEmail,
    apiGatewayName: apiStack.api.restApiName,
    stackPrefix: stackPrefix,
    env: usEast1Env,
    description: `Complete monitoring dashboard for ${appName}`,
  },
);

// Dashboard depends on API stack
monitoringDashboard.addDependency(apiStack);

// Add tags to all stacks
const tags = {
  Project: appName,
  Environment: environment === "production" ? "Production" : "Development",
  ManagedBy: "CDK",
  Frontend: "Amplify",
};

Object.entries(tags).forEach(([key, value]) => {
  cdk.Tags.of(app).add(key, value);
});

// Stack outputs summary
app.synth();
