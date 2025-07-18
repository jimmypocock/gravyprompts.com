import {
  Stack,
  StackProps,
  Duration,
  RemovalPolicy,
  CfnOutput,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as apigateway from "aws-cdk-lib/aws-apigateway";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as iam from "aws-cdk-lib/aws-iam";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as logs from "aws-cdk-lib/aws-logs";
import * as path from "path";

export interface ApiStackProps extends StackProps {
  appName: string;
  userPool: cognito.UserPool;
  userPoolClient: cognito.UserPoolClient;
}

export class ApiStack extends Stack {
  public readonly api: apigateway.RestApi;
  public readonly templatesTable: dynamodb.Table;
  public readonly templateViewsTable: dynamodb.Table;
  public readonly userPromptsTable: dynamodb.Table;
  public readonly userPermissionsTable: dynamodb.Table;
  public readonly approvalHistoryTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    // Create DynamoDB Tables
    this.templatesTable = new dynamodb.Table(this, "TemplatesTable", {
      tableName: `${props.appName}-templates`,
      partitionKey: { name: "templateId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
    });

    // Add GSIs for queries
    this.templatesTable.addGlobalSecondaryIndex({
      indexName: "userId-createdAt-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.templatesTable.addGlobalSecondaryIndex({
      indexName: "visibility-createdAt-index",
      partitionKey: { name: "visibility", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.templatesTable.addGlobalSecondaryIndex({
      indexName: "visibility-moderationStatus-index",
      partitionKey: { name: "visibility", type: dynamodb.AttributeType.STRING },
      sortKey: {
        name: "moderationStatus",
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Template views tracking table
    this.templateViewsTable = new dynamodb.Table(this, "TemplateViewsTable", {
      tableName: `${props.appName}-template-views`,
      partitionKey: { name: "viewId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
      timeToLiveAttribute: "ttl", // Auto-delete old views after 90 days
    });

    this.templateViewsTable.addGlobalSecondaryIndex({
      indexName: "templateId-timestamp-index",
      partitionKey: { name: "templateId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // User prompts table for saving populated prompts
    this.userPromptsTable = new dynamodb.Table(this, "UserPromptsTable", {
      tableName: `${props.appName}-user-prompts`,
      partitionKey: { name: "promptId", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // Add GSI for querying by user
    this.userPromptsTable.addGlobalSecondaryIndex({
      indexName: "userId-createdAt-index",
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "createdAt", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // User permissions table
    this.userPermissionsTable = new dynamodb.Table(
      this,
      "UserPermissionsTable",
      {
        tableName: `${props.appName}-user-permissions`,
        partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
        sortKey: { name: "permission", type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.RETAIN,
        pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      },
    );

    // Add GSI for querying by permission
    this.userPermissionsTable.addGlobalSecondaryIndex({
      indexName: "permission-userId-index",
      partitionKey: { name: "permission", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Approval history table
    this.approvalHistoryTable = new dynamodb.Table(
      this,
      "ApprovalHistoryTable",
      {
        tableName: `${props.appName}-approval-history`,
        partitionKey: {
          name: "historyId",
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: RemovalPolicy.RETAIN,
        pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      },
    );

    // Rate limiting table
    const rateLimitsTable = new dynamodb.Table(this, "RateLimitsTable", {
      tableName: `${props.appName}-rate-limits`,
      partitionKey: { name: "key", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.RETAIN,
      timeToLiveAttribute: "ttl", // Auto-delete expired entries
    });

    // Add GSIs for approval history queries
    this.approvalHistoryTable.addGlobalSecondaryIndex({
      indexName: "templateId-timestamp-index",
      partitionKey: { name: "templateId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    this.approvalHistoryTable.addGlobalSecondaryIndex({
      indexName: "reviewerId-timestamp-index",
      partitionKey: { name: "reviewerId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "timestamp", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Create API Gateway
    this.api = new apigateway.RestApi(this, "TemplatesApi", {
      restApiName: `${props.appName}-api`,
      description: `Template management API for ${props.appName}`,
      deployOptions: {
        stageName: "api",
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
        metricsEnabled: true,
        throttlingRateLimit: 1000,
        throttlingBurstLimit: 2000,
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          "Content-Type",
          "X-Amz-Date",
          "Authorization",
          "X-Api-Key",
          "X-Amz-Security-Token",
        ],
      },
    });

    // Create Cognito Authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      "UserPoolAuthorizer",
      {
        cognitoUserPools: [props.userPool],
        authorizerName: `${props.appName}-authorizer`,
      },
    );

    // Create request validator
    const requestValidator = new apigateway.RequestValidator(
      this,
      "BodyValidator",
      {
        restApi: this.api,
        requestValidatorName: "body-validator",
        validateRequestBody: true,
        validateRequestParameters: false,
      },
    );

    // Create request model for template creation/update
    const templateModel = new apigateway.Model(this, "TemplateModel", {
      restApi: this.api,
      contentType: "application/json",
      modelName: "TemplateModel",
      schema: {
        type: apigateway.JsonSchemaType.OBJECT,
        required: ["title", "content"],
        properties: {
          title: {
            type: apigateway.JsonSchemaType.STRING,
            minLength: 1,
            maxLength: 200,
          },
          content: {
            type: apigateway.JsonSchemaType.STRING,
            minLength: 1,
            maxLength: 50000, // 50KB max
          },
          visibility: {
            type: apigateway.JsonSchemaType.STRING,
            enum: ["public", "private"],
          },
          tags: {
            type: apigateway.JsonSchemaType.ARRAY,
            maxItems: 10,
            items: {
              type: apigateway.JsonSchemaType.STRING,
              minLength: 1,
              maxLength: 50,
            },
          },
          viewers: {
            type: apigateway.JsonSchemaType.ARRAY,
            maxItems: 100,
            items: {
              type: apigateway.JsonSchemaType.STRING,
            },
          },
        },
      },
    });

    // Lambda Layer for shared code
    const sharedLayer = new lambda.LayerVersion(this, "SharedLayer", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../lambda-layers/shared"),
      ),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: "Shared utilities and AWS SDK clients",
    });

    // Lambda execution role
    const lambdaRole = new iam.Role(this, "LambdaExecutionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole",
        ),
      ],
    });

    // Grant DynamoDB permissions
    this.templatesTable.grantReadWriteData(lambdaRole);
    this.templateViewsTable.grantReadWriteData(lambdaRole);
    this.userPromptsTable.grantReadWriteData(lambdaRole);
    this.userPermissionsTable.grantReadWriteData(lambdaRole);
    this.approvalHistoryTable.grantReadWriteData(lambdaRole);
    rateLimitsTable.grantReadWriteData(lambdaRole);

    // Grant stream read permissions for the moderation function
    this.templatesTable.grantStreamRead(lambdaRole);

    // Content moderation uses basic checks without external APIs

    // Environment variables for Lambdas
    const environment = {
      TEMPLATES_TABLE: this.templatesTable.tableName,
      TEMPLATE_VIEWS_TABLE: this.templateViewsTable.tableName,
      USER_PROMPTS_TABLE: this.userPromptsTable.tableName,
      USER_PERMISSIONS_TABLE: this.userPermissionsTable.tableName,
      APPROVAL_HISTORY_TABLE: this.approvalHistoryTable.tableName,
      RATE_LIMITS_TABLE: rateLimitsTable.tableName,
      USER_POOL_ID: props.userPool.userPoolId,
    };

    // Create Lambda functions
    const createTemplateFunction = new lambda.Function(
      this,
      "CreateTemplateFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "create.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda/templates"),
          {
            exclude: [
              "node_modules",
              "*.log",
              "local-test.js",
              "package-lock.json",
            ],
          },
        ),
        environment,
        role: lambdaRole,
        layers: [sharedLayer],
        timeout: Duration.seconds(30),
        memorySize: 256,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    const getTemplateFunction = new lambda.Function(
      this,
      "GetTemplateFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "get.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda/templates"),
          {
            exclude: [
              "node_modules",
              "*.log",
              "local-test.js",
              "package-lock.json",
            ],
          },
        ),
        environment,
        role: lambdaRole,
        layers: [sharedLayer],
        timeout: Duration.seconds(10),
        memorySize: 256, // Increased from 128MB for better performance
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    const listTemplatesFunction = new lambda.Function(
      this,
      "ListTemplatesFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "list.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda/templates"),
          {
            exclude: [
              "node_modules",
              "*.log",
              "local-test.js",
              "package-lock.json",
            ],
          },
        ),
        environment,
        role: lambdaRole,
        layers: [sharedLayer],
        timeout: Duration.seconds(30),
        memorySize: 1024, // Increased from 128MB for better CPU and search performance
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    const updateTemplateFunction = new lambda.Function(
      this,
      "UpdateTemplateFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "update.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda/templates"),
          {
            exclude: [
              "node_modules",
              "*.log",
              "local-test.js",
              "package-lock.json",
            ],
          },
        ),
        environment,
        role: lambdaRole,
        layers: [sharedLayer],
        timeout: Duration.seconds(30),
        memorySize: 256,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    const deleteTemplateFunction = new lambda.Function(
      this,
      "DeleteTemplateFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "delete.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda/templates"),
          {
            exclude: [
              "node_modules",
              "*.log",
              "local-test.js",
              "package-lock.json",
            ],
          },
        ),
        environment,
        role: lambdaRole,
        layers: [sharedLayer],
        timeout: Duration.seconds(10),
        memorySize: 128,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    const shareTemplateFunction = new lambda.Function(
      this,
      "ShareTemplateFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "share.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda/templates"),
          {
            exclude: [
              "node_modules",
              "*.log",
              "local-test.js",
              "package-lock.json",
            ],
          },
        ),
        environment,
        role: lambdaRole,
        layers: [sharedLayer],
        timeout: Duration.seconds(10),
        memorySize: 128,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    // Content moderation Lambda (triggered by DynamoDB stream)
    const moderateContentFunction = new lambda.Function(
      this,
      "ModerateContentFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "moderate.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda/moderation"),
          {
            exclude: ["node_modules", "*.log", "package-lock.json"],
          },
        ),
        environment,
        role: lambdaRole,
        layers: [sharedLayer],
        timeout: Duration.seconds(60),
        memorySize: 512,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    // Add DynamoDB stream trigger for moderation
    moderateContentFunction.addEventSourceMapping("ModerateContentTrigger", {
      eventSourceArn: this.templatesTable.tableStreamArn!,
      startingPosition: lambda.StartingPosition.LATEST,
      filters: [
        {
          pattern: JSON.stringify({
            eventName: ["INSERT", "MODIFY"],
            dynamodb: {
              NewImage: {
                visibility: { S: ["public"] },
              },
            },
          }),
        },
      ],
    });

    // API Routes
    const templates = this.api.root.addResource("templates");

    // POST /templates - Create template
    templates.addMethod(
      "POST",
      new apigateway.LambdaIntegration(createTemplateFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestValidator,
        requestModels: {
          "application/json": templateModel,
        },
      },
    );

    // GET /templates - List templates (includes popular filter)
    templates.addMethod(
      "GET",
      new apigateway.LambdaIntegration(listTemplatesFunction),
      {
        authorizationType: apigateway.AuthorizationType.NONE, // Public endpoint
      },
    );

    // Template by ID resource
    const templateById = templates.addResource("{templateId}");

    // GET /templates/{id} - Get specific template
    templateById.addMethod(
      "GET",
      new apigateway.LambdaIntegration(getTemplateFunction),
      {
        authorizationType: apigateway.AuthorizationType.NONE, // Auth handled in Lambda
      },
    );

    // PUT /templates/{id} - Update template
    templateById.addMethod(
      "PUT",
      new apigateway.LambdaIntegration(updateTemplateFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
        requestValidator,
        requestModels: {
          "application/json": templateModel,
        },
      },
    );

    // DELETE /templates/{id} - Delete template
    templateById.addMethod(
      "DELETE",
      new apigateway.LambdaIntegration(deleteTemplateFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // POST /templates/{id}/share - Share template
    const shareResource = templateById.addResource("share");
    shareResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(shareTemplateFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // Create populate template function
    const populateTemplateFunction = new lambda.Function(
      this,
      "PopulateTemplateFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "populate.handler",
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../lambda/templates"),
          {
            exclude: [
              "node_modules",
              "*.log",
              "local-test.js",
              "package-lock.json",
            ],
          },
        ),
        environment,
        role: lambdaRole,
        layers: [sharedLayer],
        timeout: Duration.seconds(10),
        memorySize: 128,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    // POST /templates/{id}/populate - Populate template with variables
    const populateResource = templateById.addResource("populate");
    populateResource.addMethod(
      "POST",
      new apigateway.LambdaIntegration(populateTemplateFunction),
      {
        authorizationType: apigateway.AuthorizationType.NONE, // Auth handled in Lambda
      },
    );

    // User Prompts Lambda Functions
    const savePromptFunction = new lambda.Function(this, "SavePromptFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "save.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/prompts"), {
        exclude: ["node_modules", "*.log", "package-lock.json"],
      }),
      environment,
      role: lambdaRole,
      layers: [sharedLayer],
      timeout: Duration.seconds(10),
      memorySize: 128,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    const listPromptsFunction = new lambda.Function(
      this,
      "ListPromptsFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "list.handler",
        code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/prompts"), {
          exclude: ["node_modules", "*.log", "package-lock.json"],
        }),
        environment,
        role: lambdaRole,
        layers: [sharedLayer],
        timeout: Duration.seconds(10),
        memorySize: 128,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    const deletePromptFunction = new lambda.Function(
      this,
      "DeletePromptFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "delete.handler",
        code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/prompts"), {
          exclude: ["node_modules", "*.log", "package-lock.json"],
        }),
        environment,
        role: lambdaRole,
        layers: [sharedLayer],
        timeout: Duration.seconds(10),
        memorySize: 128,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    // User Prompts API Routes
    const prompts = this.api.root.addResource("prompts");

    // POST /prompts - Save user prompt
    prompts.addMethod(
      "POST",
      new apigateway.LambdaIntegration(savePromptFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // GET /prompts - List user prompts
    prompts.addMethod(
      "GET",
      new apigateway.LambdaIntegration(listPromptsFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // Prompt by ID resource
    const promptById = prompts.addResource("{promptId}");

    // DELETE /prompts/{id} - Delete user prompt
    promptById.addMethod(
      "DELETE",
      new apigateway.LambdaIntegration(deletePromptFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // Admin Lambda Functions
    const permissionsFunction = new lambda.Function(
      this,
      "PermissionsFunction",
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: "permissions.handler",
        code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/admin"), {
          exclude: ["node_modules", "*.log", "package-lock.json"],
        }),
        environment,
        role: lambdaRole,
        layers: [sharedLayer],
        timeout: Duration.seconds(10),
        memorySize: 128,
        logRetention: logs.RetentionDays.ONE_WEEK,
      },
    );

    const approvalFunction = new lambda.Function(this, "ApprovalFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: "approval.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/admin"), {
        exclude: ["node_modules", "*.log", "package-lock.json"],
      }),
      environment,
      role: lambdaRole,
      layers: [sharedLayer],
      timeout: Duration.seconds(30),
      memorySize: 256,
      logRetention: logs.RetentionDays.ONE_WEEK,
    });

    // Admin API Routes
    const admin = this.api.root.addResource("admin");

    // Permissions management
    const permissions = admin.addResource("permissions");

    // GET /admin/permissions/me - Get current user's permissions
    const permissionsMe = permissions.addResource("me");
    permissionsMe.addMethod(
      "GET",
      new apigateway.LambdaIntegration(permissionsFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // GET /admin/permissions/users - List users with permissions
    const permissionsUsers = permissions.addResource("users");
    permissionsUsers.addMethod(
      "GET",
      new apigateway.LambdaIntegration(permissionsFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // GET /admin/permissions/user/{userId} - Get user permissions
    const permissionsUser = permissions.addResource("user");
    const permissionsUserById = permissionsUser.addResource("{userId}");
    permissionsUserById.addMethod(
      "GET",
      new apigateway.LambdaIntegration(permissionsFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // POST /admin/permissions - Grant permission
    permissions.addMethod(
      "POST",
      new apigateway.LambdaIntegration(permissionsFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // DELETE /admin/permissions/{userId}/{permission} - Revoke permission
    const permissionsUserByIdAndPermission =
      permissionsUserById.addResource("{permission}");
    permissionsUserByIdAndPermission.addMethod(
      "DELETE",
      new apigateway.LambdaIntegration(permissionsFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // Approval management
    const approval = admin.addResource("approval");

    // GET /admin/approval/queue - Get approval queue
    const approvalQueue = approval.addResource("queue");
    approvalQueue.addMethod(
      "GET",
      new apigateway.LambdaIntegration(approvalFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // GET /admin/approval/history - Get approval history
    const approvalHistory = approval.addResource("history");
    approvalHistory.addMethod(
      "GET",
      new apigateway.LambdaIntegration(approvalFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // POST /admin/approval/template/{templateId} - Process approval
    const approvalTemplate = approval.addResource("template");
    const approvalTemplateById = approvalTemplate.addResource("{templateId}");
    approvalTemplateById.addMethod(
      "POST",
      new apigateway.LambdaIntegration(approvalFunction),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      },
    );

    // Add usage plan for rate limiting per user
    const plan = this.api.addUsagePlan("PerUserThrottling", {
      name: `${props.appName}-per-user`,
      throttle: {
        rateLimit: 10, // requests per second
        burstLimit: 20,
      },
      quota: {
        limit: 1000, // requests per day
        period: apigateway.Period.DAY,
      },
    });

    plan.addApiStage({
      stage: this.api.deploymentStage,
    });

    // Outputs
    new CfnOutput(this, "ApiUrl", {
      value: this.api.url,
      description: "API Gateway URL",
      exportName: `${this.stackName}-ApiUrl`,
    });

    new CfnOutput(this, "TemplatesTableName", {
      value: this.templatesTable.tableName,
      description: "Templates DynamoDB table name",
      exportName: `${this.stackName}-TemplatesTable`,
    });

    new CfnOutput(this, "TemplateViewsTableName", {
      value: this.templateViewsTable.tableName,
      description: "Template views DynamoDB table name",
      exportName: `${this.stackName}-TemplateViewsTable`,
    });
  }
}
