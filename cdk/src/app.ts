#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { FoundationStack } from './foundation-stack';
import { CertificateStack } from './certificate-stack';
import { EdgeFunctionsStack } from './edge-functions-stack';
import { CdnStack } from './cdn-stack';
import { WafStack } from './waf-stack';
import { MonitoringStack } from './monitoring-stack';
import { AppStack } from './app-stack';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

const app = new cdk.App();

// Configuration - Get from environment variables or CDK context
const domainName = process.env.DOMAIN_NAME || app.node.tryGetContext('domainName') || 'example.com';
const appName = process.env.APP_NAME || app.node.tryGetContext('appName') || 'nextjs-app';
const stackPrefix = process.env.STACK_PREFIX || app.node.tryGetContext('stackPrefix') || appName.toUpperCase().replace(/[^A-Z0-9]/g, '');
const certificateArn = process.env.CERTIFICATE_ARN || app.node.tryGetContext('certificateArn');
const notificationEmail = app.node.tryGetContext('notificationEmail');

// Common environment for us-east-1 (required for CloudFront, ACM, and WAF)
const usEast1Env = {
  region: 'us-east-1',
  account: process.env.CDK_DEFAULT_ACCOUNT,
};

// 1. Foundation Stack - S3 buckets for website and logs
const foundationStack = new FoundationStack(app, `${stackPrefix}-Foundation`, {
  domainName: domainName,
  env: usEast1Env,
  description: `Foundation resources (S3 buckets) for ${appName}`,
});

// 2. Certificate Stack - ACM certificate management
let certificateStack: CertificateStack | undefined;

// Only create certificate stack if explicitly requested via context
// Never create it when we already have a certificate ARN (to avoid deletion)
if (app.node.tryGetContext('createCertificate') === 'true') {
  certificateStack = new CertificateStack(app, `${stackPrefix}-Certificate`, {
    domainName: domainName,
    certificateArn: certificateArn,
    env: usEast1Env,
    description: `SSL/TLS certificate for ${appName}`,
  });
}

// If we have a certificate ARN but no stack, import it directly
let certificate: acm.ICertificate | undefined;
if (certificateArn && !certificateStack) {
  certificate = acm.Certificate.fromCertificateArn(
    foundationStack,
    'ImportedCertificate',
    certificateArn
  );
}

// 3. Edge Functions Stack - CloudFront Functions
const edgeFunctionsStack = new EdgeFunctionsStack(app, `${stackPrefix}-EdgeFunctions`, {
  domainName: domainName,
  env: usEast1Env,
  description: `CloudFront Functions for ${appName}`,
});

// 4. WAF Stack - Web Application Firewall
const wafStack = new WafStack(app, `${stackPrefix}-WAF`, {
  env: usEast1Env,
  description: `WAF rules for ${appName}`,
});

// 5. CDN Stack - CloudFront distribution and deployment
const cdnStack = new CdnStack(app, `${stackPrefix}-CDN`, {
  domainName: domainName,
  certificate: certificateStack?.certificate || certificate,
  redirectFunction: edgeFunctionsStack.redirectFunction,
  securityHeadersFunction: edgeFunctionsStack.securityHeadersFunction,
  webAclArn: wafStack.webAcl.attrArn,
  env: usEast1Env,
  description: `CDN distribution for ${appName}`,
});

// Add dependencies
cdnStack.addDependency(foundationStack);
// Only add certificate dependency if certificate stack exists
if (certificateStack) {
  cdnStack.addDependency(certificateStack);
}
cdnStack.addDependency(edgeFunctionsStack);
cdnStack.addDependency(wafStack);

// 6. Monitoring Stack - CloudWatch alarms and dashboards
const monitoringStack = new MonitoringStack(app, `${stackPrefix}-Monitoring`, {
  distributionId: cdnStack.distribution.distributionId,
  emailAddress: notificationEmail,
  env: usEast1Env,
  description: `Monitoring and alerting for ${appName}`,
});

// Add dependency
monitoringStack.addDependency(cdnStack);

// 7. App Stack - Application deployment
const appStack = new AppStack(app, `${stackPrefix}-App`, {
  websiteBucketName: `${domainName}-app`,
  cdnStackName: `${stackPrefix}-CDN`,
  env: usEast1Env,
  description: `Application deployment for ${appName}`,
});

// Add dependencies for app deployment (only foundation needed now)
appStack.addDependency(foundationStack);

// Add tags to all stacks
const tags = {
  Project: appName,
  Environment: 'Production',
  ManagedBy: 'CDK',
};

Object.entries(tags).forEach(([key, value]) => {
  cdk.Tags.of(app).add(key, value);
});

// Stack outputs summary
app.synth();