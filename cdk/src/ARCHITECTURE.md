# AWS CDK Architecture - Amplify Backend

This document describes the backend infrastructure for the GravyPrompts application hosted on AWS Amplify.

## Overview

The application uses AWS Amplify for frontend hosting and CI/CD, with CDK-managed backend services for authentication, API, and data storage.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Amplify                              │
│  - Frontend Hosting (Next.js SSR)                              │
│  - Custom Domain (gravyprompts.com)                            │
│  - SSL/TLS Certificate                                         │
│  - CI/CD Pipeline                                              │
│  - Branch Previews                                             │
└────────────────────────┬───────────────────────────────────────┘
                         │
                         │ HTTPS
                         │
┌────────────────────────┴───────────────────────────────────────┐
│                    Backend Services (CDK)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐                  │
│  │   Auth Stack    │     │    API Stack    │                  │
│  │                 │     │                 │                  │
│  │  AWS Cognito    │     │  API Gateway    │                  │
│  │  - User Pool    │────▶│  - REST API     │                  │
│  │  - Client App   │     │  - CORS config  │                  │
│  └─────────────────┘     └────────┬────────┘                  │
│                                    │                           │
│                          ┌─────────┴─────────┐                 │
│                          │  Lambda Functions │                 │
│                          │  - Templates CRUD │                 │
│                          │  - Moderation     │                 │
│                          └─────────┬─────────┘                 │
│                                    │                           │
│                          ┌─────────┴─────────┐                 │
│                          │     DynamoDB      │                 │
│                          │  - Templates      │                 │
│                          │  - Template Views │                 │
│                          └───────────────────┘                 │
│                                                                │
│  ┌─────────────────┐     ┌─────────────────┐                  │
│  │ Certificate     │     │  WAF (Optional)  │                  │
│  │ Stack           │     │                 │                  │
│  │ ACM Certificate │     │  Rate Limiting  │                  │
│  └─────────────────┘     └─────────────────┘                  │
│                                                                │
│  ┌─────────────────────────────────────────┐                  │
│  │         Monitoring Stack                 │                  │
│  │  - CloudWatch Dashboards                │                  │
│  │  - API/Lambda Metrics                   │                  │
│  │  - Cost Tracking                        │                  │
│  │  - Email Alerts (SNS)                   │                  │
│  └─────────────────────────────────────────┘                  │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

## Stack Details

### 1. **Auth Stack** (`auth-stack.ts`)

- **Purpose**: User authentication and authorization
- **Resources**:
  - AWS Cognito User Pool
  - User Pool Client
  - Email verification
  - Password policies
- **Environment-aware**: Separate pools for dev/prod

### 2. **API Stack** (`api-stack.ts`)

- **Purpose**: Backend API and data storage
- **Resources**:
  - API Gateway REST API
  - Lambda functions for CRUD operations
  - DynamoDB tables
  - Lambda layers for shared code
- **Features**:
  - JWT authorization via Cognito
  - CORS configuration
  - Request/response validation

### 3. **Certificate Stack** (`certificate-stack.ts`) - Optional

- **Purpose**: SSL/TLS certificate management
- **Resources**:
  - ACM Certificate
  - DNS validation
- **Note**: Can be reused by Amplify or created separately

### 4. **WAF Stack** (`waf-stack.ts`) - Optional

- **Purpose**: Web Application Firewall
- **Resources**:
  - WAF rules
  - Rate limiting
  - Geo-blocking
- **Note**: Can be attached to Amplify distribution

### 5. **Monitoring Stack** (`monitoring-stack-amplify.ts`)

- **Purpose**: Application monitoring and alerting
- **Resources**:
  - CloudWatch dashboards
  - SNS topic for alerts
  - CloudWatch alarms
  - Cost tracking

## Deployment Order

1. **Certificate** (optional) - Only if creating new certificate
2. **Auth Stack** - Must be deployed before API
3. **API Stack** - Depends on Auth for user pool reference
4. **WAF Stack** (optional) - Independent
5. **Monitoring Stack** (optional) - Depends on API for metrics

## Environment Variables

Frontend (Amplify) requires:

```bash
NEXT_PUBLIC_API_URL               # API Gateway URL
NEXT_PUBLIC_COGNITO_USER_POOL_ID  # Cognito User Pool ID
NEXT_PUBLIC_COGNITO_CLIENT_ID     # Cognito Client ID
NEXT_PUBLIC_APP_URL               # Application URL
```

## Benefits of Amplify + CDK Backend

1. **Simplified Frontend**: No need to manage S3, CloudFront, or deployment
2. **Built-in CI/CD**: Automatic deployments on git push
3. **Branch Previews**: Test features in isolation
4. **Managed SSL**: Automatic certificate provisioning
5. **Backend Control**: Full control over API, auth, and data with CDK
6. **Cost Effective**: Pay only for backend resources + Amplify hosting

## Local Development

The backend can be run locally using:

- LocalStack for DynamoDB
- SAM CLI for API Gateway/Lambda
- Docker for containerization

See `LOCAL_DEVELOPMENT.md` for details.
