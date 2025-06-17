import * as cdk from "aws-cdk-lib";
import * as budgets from "aws-cdk-lib/aws-budgets";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import { Construct } from "constructs";

export class BudgetStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get email from context or environment
    const alertEmail = this.node.tryGetContext("alertEmail") || 
                      process.env.BUDGET_ALERT_EMAIL;
    
    if (!alertEmail || alertEmail === "your-email@example.com") {
      throw new Error(
        "BUDGET_ALERT_EMAIL must be set in your .env file or passed via --context alertEmail=your-email@example.com"
      );
    }

    // Create SNS topic for budget alerts
    const budgetTopic = new sns.Topic(this, "BudgetAlertTopic", {
      displayName: "GravyPrompts Budget Alerts",
    });

    // Add email subscription
    budgetTopic.addSubscription(
      new subscriptions.EmailSubscription(alertEmail)
    );

    // Overall monthly budget for the entire AWS account
    new budgets.CfnBudget(this, "MonthlyBudget", {
      budget: {
        budgetName: "GravyPrompts-Monthly-Total",
        budgetType: "COST",
        timeUnit: "MONTHLY",
        budgetLimit: {
          amount: 50, // $50/month total budget
          unit: "USD",
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 80, // Alert at 80% of budget
            thresholdType: "PERCENTAGE",
          },
          subscribers: [
            {
              subscriptionType: "SNS",
              address: budgetTopic.topicArn,
            },
          ],
        },
        {
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 100, // Alert when exceeding budget
            thresholdType: "PERCENTAGE",
          },
          subscribers: [
            {
              subscriptionType: "SNS",
              address: budgetTopic.topicArn,
            },
          ],
        },
      ],
    });

    // Service-specific budgets
    const services = [
      { name: "Lambda", budget: 5 },
      { name: "DynamoDB", budget: 10 },
      { name: "API Gateway", budget: 5 },
      { name: "CloudWatch", budget: 5 },
      { name: "S3", budget: 5 },
      { name: "Amplify", budget: 10 },
    ];

    services.forEach((service) => {
      new budgets.CfnBudget(this, `${service.name}Budget`, {
        budget: {
          budgetName: `GravyPrompts-${service.name}`,
          budgetType: "COST",
          timeUnit: "MONTHLY",
          budgetLimit: {
            amount: service.budget,
            unit: "USD",
          },
          costFilters: {
            Service: [service.name === "Lambda" ? "AWS Lambda" : 
                     service.name === "DynamoDB" ? "Amazon DynamoDB" :
                     service.name === "API Gateway" ? "Amazon API Gateway" :
                     service.name === "CloudWatch" ? "AmazonCloudWatch" :
                     service.name === "S3" ? "Amazon Simple Storage Service" :
                     service.name === "Amplify" ? "AWS Amplify" : service.name],
          },
        },
        notificationsWithSubscribers: [
          {
            notification: {
              notificationType: "ACTUAL",
              comparisonOperator: "GREATER_THAN",
              threshold: 80,
              thresholdType: "PERCENTAGE",
            },
            subscribers: [
              {
                subscriptionType: "SNS",
                address: budgetTopic.topicArn,
              },
            ],
          },
        ],
      });
    });

    // Daily spend anomaly detector
    new budgets.CfnBudget(this, "DailyAnomalyBudget", {
      budget: {
        budgetName: "GravyPrompts-Daily-Anomaly",
        budgetType: "COST",
        timeUnit: "DAILY",
        budgetLimit: {
          amount: 5, // Alert if daily spend exceeds $5
          unit: "USD",
        },
      },
      notificationsWithSubscribers: [
        {
          notification: {
            notificationType: "ACTUAL",
            comparisonOperator: "GREATER_THAN",
            threshold: 100,
            thresholdType: "PERCENTAGE",
          },
          subscribers: [
            {
              subscriptionType: "SNS",
              address: budgetTopic.topicArn,
            },
          ],
        },
      ],
    });

    // Output the SNS topic ARN
    new cdk.CfnOutput(this, "BudgetAlertTopicArn", {
      value: budgetTopic.topicArn,
      description: "SNS Topic ARN for budget alerts",
    });
  }
}