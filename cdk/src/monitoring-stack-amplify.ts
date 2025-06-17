import { Stack, StackProps, Duration, CfnOutput } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as sns from "aws-cdk-lib/aws-sns";
import * as cloudwatch_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as logs from "aws-cdk-lib/aws-logs";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";

export interface MonitoringStackAmplifyProps extends StackProps {
  emailAddress?: string;
  apiGatewayName?: string;
}

export class MonitoringStackAmplify extends Stack {
  public readonly alertTopic: sns.Topic;
  public readonly dashboard: cloudwatch.Dashboard;

  constructor(
    scope: Construct,
    id: string,
    props: MonitoringStackAmplifyProps,
  ) {
    super(scope, id, props);

    // SNS Topic for alerts
    this.alertTopic = new sns.Topic(this, "AppAlerts", {
      displayName: `${this.stackName} Alerts`,
    });

    // Add email subscription if provided
    if (props.emailAddress) {
      this.alertTopic.addSubscription(
        new subscriptions.EmailSubscription(props.emailAddress),
      );
    }

    // CloudWatch Log Group for application logs
    const logGroup = new logs.LogGroup(this, "AppLogs", {
      logGroupName: `/aws/amplify/${this.stackName.toLowerCase()}`,
      retention: logs.RetentionDays.ONE_MONTH,
    });

    // Billing Alerts
    const billingAlarm10 = new cloudwatch.Alarm(this, "BillingAlarm10", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Billing",
        metricName: "EstimatedCharges",
        dimensionsMap: {
          Currency: "USD",
        },
        statistic: "Maximum",
        period: Duration.hours(6),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "Alert when AWS bill exceeds $10",
    });

    const billingAlarm50 = new cloudwatch.Alarm(this, "BillingAlarm50", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Billing",
        metricName: "EstimatedCharges",
        dimensionsMap: {
          Currency: "USD",
        },
        statistic: "Maximum",
        period: Duration.hours(6),
      }),
      threshold: 50,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "Alert when AWS bill exceeds $50",
    });

    const billingAlarm100 = new cloudwatch.Alarm(this, "BillingAlarm100", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/Billing",
        metricName: "EstimatedCharges",
        dimensionsMap: {
          Currency: "USD",
        },
        statistic: "Maximum",
        period: Duration.hours(6),
      }),
      threshold: 100,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "Alert when AWS bill exceeds $100",
    });

    // Add alarm actions
    billingAlarm10.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.alertTopic),
    );
    billingAlarm50.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.alertTopic),
    );
    billingAlarm100.addAlarmAction(
      new cloudwatch_actions.SnsAction(this.alertTopic),
    );

    // API Gateway Metrics (if API name provided)
    let apiErrorAlarm: cloudwatch.Alarm | undefined;
    let apiLatencyAlarm: cloudwatch.Alarm | undefined;

    if (props.apiGatewayName) {
      // API 4XX Errors
      apiErrorAlarm = new cloudwatch.Alarm(this, "Api4xxAlarm", {
        metric: new cloudwatch.Metric({
          namespace: "AWS/ApiGateway",
          metricName: "4XXError",
          dimensionsMap: {
            ApiName: props.apiGatewayName,
          },
          statistic: "Sum",
          period: Duration.minutes(5),
        }),
        threshold: 10,
        evaluationPeriods: 1,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription:
          "Alert when API has more than 10 4XX errors in 5 minutes",
      });

      // API Latency
      apiLatencyAlarm = new cloudwatch.Alarm(this, "ApiLatencyAlarm", {
        metric: new cloudwatch.Metric({
          namespace: "AWS/ApiGateway",
          metricName: "Latency",
          dimensionsMap: {
            ApiName: props.apiGatewayName,
          },
          statistic: "Average",
          period: Duration.minutes(5),
        }),
        threshold: 1000, // 1 second
        evaluationPeriods: 2,
        treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        alarmDescription: "Alert when API latency exceeds 1 second",
      });

      apiErrorAlarm.addAlarmAction(
        new cloudwatch_actions.SnsAction(this.alertTopic),
      );
      apiLatencyAlarm.addAlarmAction(
        new cloudwatch_actions.SnsAction(this.alertTopic),
      );
    }

    // CloudWatch Dashboard
    this.dashboard = new cloudwatch.Dashboard(this, "AppDashboard", {
      dashboardName: `${this.stackName}-Dashboard`,
    });

    // Billing Widget
    this.dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "AWS Billing",
        left: [
          new cloudwatch.Metric({
            namespace: "AWS/Billing",
            metricName: "EstimatedCharges",
            dimensionsMap: {
              Currency: "USD",
            },
            statistic: "Maximum",
            period: Duration.hours(6),
          }),
        ],
        width: 12,
        height: 6,
      }),
    );

    // API Widgets (if applicable)
    if (props.apiGatewayName) {
      this.dashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: "API Gateway Requests",
          left: [
            new cloudwatch.Metric({
              namespace: "AWS/ApiGateway",
              metricName: "Count",
              dimensionsMap: {
                ApiName: props.apiGatewayName,
              },
              statistic: "Sum",
              period: Duration.minutes(5),
            }),
          ],
          width: 12,
          height: 6,
        }),
        new cloudwatch.GraphWidget({
          title: "API Gateway Errors",
          left: [
            new cloudwatch.Metric({
              namespace: "AWS/ApiGateway",
              metricName: "4XXError",
              dimensionsMap: {
                ApiName: props.apiGatewayName,
              },
              statistic: "Sum",
              period: Duration.minutes(5),
            }),
            new cloudwatch.Metric({
              namespace: "AWS/ApiGateway",
              metricName: "5XXError",
              dimensionsMap: {
                ApiName: props.apiGatewayName,
              },
              statistic: "Sum",
              period: Duration.minutes(5),
            }),
          ],
          width: 12,
          height: 6,
        }),
      );
    }

    // Outputs
    new CfnOutput(this, "AlertTopicArn", {
      value: this.alertTopic.topicArn,
      description: "SNS Topic ARN for alerts",
    });

    new CfnOutput(this, "DashboardURL", {
      value: `https://console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${this.dashboard.dashboardName}`,
      description: "CloudWatch Dashboard URL",
    });
  }
}
