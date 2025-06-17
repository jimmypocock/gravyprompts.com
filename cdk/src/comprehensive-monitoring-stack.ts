import { Stack, StackProps, Duration, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as sns from "aws-cdk-lib/aws-sns";
import * as cloudwatch_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";

export interface ComprehensiveMonitoringStackProps extends StackProps {
  emailAddress?: string;
  apiGatewayName: string;
  stackPrefix: string;
}

export class ComprehensiveMonitoringStack extends Stack {
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(
    scope: Construct,
    id: string,
    props: ComprehensiveMonitoringStackProps,
  ) {
    super(scope, id, props);

    // Create CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, "ComprehensiveDashboard", {
      dashboardName: `${props.stackPrefix}-Complete-Dashboard`,
      periodOverride: cloudwatch.PeriodOverride.AUTO,
    });

    // ==== Row 1: Cost & Usage Overview ====
    this.dashboard.addWidgets(
      // Total AWS Costs
      new cloudwatch.GraphWidget({
        title: "Total AWS Costs (Daily)",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Billing",
            metricName: "EstimatedCharges",
            dimensionsMap: { Currency: "USD" },
            statistic: "Maximum",
            period: Duration.days(1),
          }),
        ],
        width: 8,
        height: 6,
        leftYAxis: {
          label: "Cost (USD)",
          showUnits: false,
        },
      }),

      // Service Breakdown
      new cloudwatch.SingleValueWidget({
        title: "Current Month Costs by Service",
        metrics: [
          new cloudwatch.Metric({
            namespace: "AWS/Billing",
            metricName: "EstimatedCharges",
            dimensionsMap: { 
              Currency: "USD",
              ServiceName: "AmazonDynamoDB"
            },
            statistic: "Maximum",
            label: "DynamoDB",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Billing",
            metricName: "EstimatedCharges",
            dimensionsMap: { 
              Currency: "USD",
              ServiceName: "AWSLambda"
            },
            statistic: "Maximum",
            label: "Lambda",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Billing",
            metricName: "EstimatedCharges",
            dimensionsMap: { 
              Currency: "USD",
              ServiceName: "AmazonApiGateway"
            },
            statistic: "Maximum",
            label: "API Gateway",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Billing",
            metricName: "EstimatedCharges",
            dimensionsMap: { 
              Currency: "USD",
              ServiceName: "AWSAmplify"
            },
            statistic: "Maximum",
            label: "Amplify",
          }),
        ],
        width: 8,
        height: 6,
        setPeriodToTimeRange: true,
      }),

      // API Request Count
      new cloudwatch.SingleValueWidget({
        title: "API Requests (Today)",
        metrics: [
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "Count",
            dimensionsMap: { ApiName: props.apiGatewayName },
            statistic: "Sum",
            period: Duration.days(1),
          }),
        ],
        width: 8,
        height: 6,
      }),
    );

    // ==== Row 2: API Gateway Metrics ====
    this.dashboard.addWidgets(
      // API Requests Over Time
      new cloudwatch.GraphWidget({
        title: "API Requests",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "Count",
            dimensionsMap: { ApiName: props.apiGatewayName },
            statistic: "Sum",
            period: Duration.minutes(5),
            color: cloudwatch.Color.GREEN,
          }),
        ],
        width: 8,
        height: 6,
      }),

      // API Errors
      new cloudwatch.GraphWidget({
        title: "API Errors",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "4XXError",
            dimensionsMap: { ApiName: props.apiGatewayName },
            statistic: "Sum",
            period: Duration.minutes(5),
            color: cloudwatch.Color.ORANGE,
            label: "4XX Errors",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "5XXError",
            dimensionsMap: { ApiName: props.apiGatewayName },
            statistic: "Sum",
            period: Duration.minutes(5),
            color: cloudwatch.Color.RED,
            label: "5XX Errors",
          }),
        ],
        width: 8,
        height: 6,
        leftYAxis: {
          label: "Error Count",
          showUnits: false,
        },
      }),

      // API Latency
      new cloudwatch.GraphWidget({
        title: "API Latency",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "Latency",
            dimensionsMap: { ApiName: props.apiGatewayName },
            statistic: "Average",
            period: Duration.minutes(5),
            color: cloudwatch.Color.BLUE,
            label: "Average",
          }),
          new cloudwatch.Metric({
            namespace: "AWS/ApiGateway",
            metricName: "Latency",
            dimensionsMap: { ApiName: props.apiGatewayName },
            statistic: "p99",
            period: Duration.minutes(5),
            color: cloudwatch.Color.PURPLE,
            label: "p99",
          }),
        ],
        width: 8,
        height: 6,
        leftYAxis: {
          label: "Latency (ms)",
          showUnits: false,
        },
      }),
    );

    // ==== Row 3: Lambda Functions ====
    const lambdaFunctions = [
      "CreateTemplateFunction",
      "ListTemplatesFunction",
      "GetTemplateFunction",
      "UpdateTemplateFunction",
      "DeleteTemplateFunction",
    ];

    this.dashboard.addWidgets(
      // Lambda Invocations
      new cloudwatch.GraphWidget({
        title: "Lambda Invocations",
        left: lambdaFunctions.map(fn => 
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Invocations",
            dimensionsMap: { FunctionName: `${props.stackPrefix}-API-${fn}` },
            statistic: "Sum",
            period: Duration.minutes(5),
            label: fn.replace("Function", ""),
          })
        ),
        width: 12,
        height: 6,
        legendPosition: cloudwatch.LegendPosition.RIGHT,
      }),

      // Lambda Errors
      new cloudwatch.GraphWidget({
        title: "Lambda Errors",
        left: lambdaFunctions.map(fn => 
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Errors",
            dimensionsMap: { FunctionName: `${props.stackPrefix}-API-${fn}` },
            statistic: "Sum",
            period: Duration.minutes(5),
            label: fn.replace("Function", ""),
          })
        ),
        width: 6,
        height: 6,
        leftYAxis: {
          label: "Error Count",
          showUnits: false,
        },
      }),

      // Lambda Duration
      new cloudwatch.GraphWidget({
        title: "Lambda Duration (Avg)",
        left: lambdaFunctions.map(fn => 
          new cloudwatch.Metric({
            namespace: "AWS/Lambda",
            metricName: "Duration",
            dimensionsMap: { FunctionName: `${props.stackPrefix}-API-${fn}` },
            statistic: "Average",
            period: Duration.minutes(5),
            label: fn.replace("Function", ""),
          })
        ),
        width: 6,
        height: 6,
        leftYAxis: {
          label: "Duration (ms)",
          showUnits: false,
        },
      }),
    );

    // ==== Row 4: DynamoDB Tables ====
    const tables = ["templates", "template-views", "user-prompts"];

    this.dashboard.addWidgets(
      // DynamoDB Read Capacity
      new cloudwatch.GraphWidget({
        title: "DynamoDB Consumed Read Capacity",
        left: tables.map(table => 
          new cloudwatch.Metric({
            namespace: "AWS/DynamoDB",
            metricName: "ConsumedReadCapacityUnits",
            dimensionsMap: { TableName: table },
            statistic: "Sum",
            period: Duration.minutes(5),
            label: table,
          })
        ),
        width: 8,
        height: 6,
      }),

      // DynamoDB Write Capacity
      new cloudwatch.GraphWidget({
        title: "DynamoDB Consumed Write Capacity",
        left: tables.map(table => 
          new cloudwatch.Metric({
            namespace: "AWS/DynamoDB",
            metricName: "ConsumedWriteCapacityUnits",
            dimensionsMap: { TableName: table },
            statistic: "Sum",
            period: Duration.minutes(5),
            label: table,
          })
        ),
        width: 8,
        height: 6,
      }),

      // DynamoDB Throttles
      new cloudwatch.GraphWidget({
        title: "DynamoDB Throttled Requests",
        left: tables.map(table => 
          new cloudwatch.Metric({
            namespace: "AWS/DynamoDB",
            metricName: "UserErrors",
            dimensionsMap: { TableName: table },
            statistic: "Sum",
            period: Duration.minutes(5),
            label: table,
          })
        ),
        width: 8,
        height: 6,
        leftYAxis: {
          label: "Throttled Requests",
          showUnits: false,
        },
      }),
    );

    // ==== Row 5: Cognito & Amplify ====
    this.dashboard.addWidgets(
      // Cognito Sign Ups
      new cloudwatch.GraphWidget({
        title: "Cognito User Activity",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Cognito",
            metricName: "SignUpSuccesses",
            dimensionsMap: { 
              UserPool: `${props.stackPrefix}-Auth-UserPool`,
              UserPoolClient: `${props.stackPrefix}-Auth-UserPoolClient`
            },
            statistic: "Sum",
            period: Duration.hours(1),
            label: "Sign Ups",
            color: cloudwatch.Color.GREEN,
          }),
          new cloudwatch.Metric({
            namespace: "AWS/Cognito",
            metricName: "SignInSuccesses",
            dimensionsMap: { 
              UserPool: `${props.stackPrefix}-Auth-UserPool`,
              UserPoolClient: `${props.stackPrefix}-Auth-UserPoolClient`
            },
            statistic: "Sum",
            period: Duration.hours(1),
            label: "Sign Ins",
            color: cloudwatch.Color.BLUE,
          }),
        ],
        width: 12,
        height: 6,
      }),

      // Amplify Build Minutes
      new cloudwatch.SingleValueWidget({
        title: "Amplify Build Minutes (This Month)",
        metrics: [
          new cloudwatch.Metric({
            namespace: "AWS/Amplify",
            metricName: "BuildMinutes",
            statistic: "Sum",
            period: Duration.days(30),
          }),
        ],
        width: 6,
        height: 6,
      }),

      // CloudWatch Logs Ingestion
      new cloudwatch.SingleValueWidget({
        title: "Log Ingestion (GB This Month)",
        metrics: [
          new cloudwatch.Metric({
            namespace: "AWS/Logs",
            metricName: "IncomingBytes",
            statistic: "Sum",
            period: Duration.days(30),
          }),
        ],
        width: 6,
        height: 6,
      }),
    );

    // ==== Row 6: Business Metrics ====
    this.dashboard.addWidgets(
      // Custom Business Metrics (placeholders - need custom metrics)
      new cloudwatch.TextWidget({
        markdown: `## Business Metrics
        
**Template Statistics** (requires custom metrics):
- Total Templates Created
- Most Popular Templates
- Templates by Category
- User Engagement Rate

**User Statistics** (requires custom metrics):
- Active Users (DAU/MAU)
- New vs Returning Users
- User Geographic Distribution

To enable these metrics, implement custom CloudWatch metrics in your Lambda functions.`,
        width: 24,
        height: 6,
      }),
    );

    // Output dashboard URL
    new CfnOutput(this, "DashboardURL", {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: "CloudWatch Dashboard URL",
    });
  }
}