import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

interface CacheStackProps extends cdk.StackProps {
  api: apigateway.RestApi;
}

export class CacheStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CacheStackProps) {
    super(scope, id, props);

    // Custom cache policy that respects Cache-Control headers but includes Authorization
    const respectOriginWithAuthPolicy = new cloudfront.CachePolicy(this, 'RespectOriginWithAuth', {
      cachePolicyName: 'GravyPrompts-Respect-Origin-With-Auth',
      comment: 'Respects origin Cache-Control headers and varies by Authorization',
      defaultTtl: cdk.Duration.seconds(0), // Let origin control via Cache-Control
      maxTtl: cdk.Duration.days(365), // Maximum allowed by CloudFront
      minTtl: cdk.Duration.seconds(0),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Authorization', // Vary cache by auth header
        'Cache-Control', // Pass through Cache-Control
      ),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });

    // Origin request policy to forward necessary headers
    const originRequestPolicy = new cloudfront.OriginRequestPolicy(this, 'OriginRequestPolicy', {
      originRequestPolicyName: 'GravyPrompts-Origin-Request-Policy',
      comment: 'Forward headers to API Gateway',
      queryStringBehavior: cloudfront.OriginRequestQueryStringBehavior.all(),
      headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
        'Authorization',
        'Content-Type',
        'X-Forwarded-For',
        'User-Agent'
      ),
      cookieBehavior: cloudfront.OriginRequestCookieBehavior.none(),
    });

    // Create CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'ApiDistribution', {
      comment: 'GravyPrompts API CDN Distribution',
      defaultBehavior: {
        origin: new origins.RestApiOrigin(props.api),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: respectOriginWithAuthPolicy,
        originRequestPolicy: originRequestPolicy,
        compress: true,
      },
      additionalBehaviors: {
        // Template listing - respects origin cache headers
        '/templates': {
          origin: new origins.RestApiOrigin(props.api),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: respectOriginWithAuthPolicy,
          originRequestPolicy: originRequestPolicy,
          compress: true,
        },
        // Individual templates - respects origin cache headers
        '/templates/*': {
          origin: new origins.RestApiOrigin(props.api),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: respectOriginWithAuthPolicy,
          originRequestPolicy: originRequestPolicy,
          compress: true,
        },
        // Admin endpoints - never cache
        '/admin/*': {
          origin: new origins.RestApiOrigin(props.api),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: originRequestPolicy,
          compress: true,
        },
        // User prompts - never cache
        '/prompts': {
          origin: new origins.RestApiOrigin(props.api),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: originRequestPolicy,
          compress: true,
        },
        '/prompts/*': {
          origin: new origins.RestApiOrigin(props.api),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: originRequestPolicy,
          compress: true,
        },
      },
      enableLogging: true,
      logBucket: undefined, // Use CloudFront default bucket
      logFilePrefix: 'cdn-logs/',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe edge locations to reduce costs
    });

    // Cost Protection: Create SNS topic for alerts
    const alertTopic = new sns.Topic(this, 'CloudFrontAlertTopic', {
      topicName: 'GravyPrompts-CloudFront-Alerts',
      displayName: 'GravyPrompts CloudFront Cost Alerts',
    });

    // Cost Protection: Monitor data transfer costs
    const dataTransferAlarm = new cloudwatch.Alarm(this, 'DataTransferAlarm', {
      alarmName: 'GravyPrompts-CloudFront-HighDataTransfer',
      alarmDescription: 'Alert when CloudFront data transfer exceeds threshold',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/CloudFront',
        metricName: 'BytesDownloaded',
        dimensionsMap: {
          DistributionId: this.distribution.distributionId,
        },
        statistic: 'Sum',
        period: cdk.Duration.days(1),
      }),
      threshold: 10 * 1024 * 1024 * 1024, // 10 GB per day
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dataTransferAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));

    // Cost Protection: Monitor origin requests (cache misses)
    const originRequestsAlarm = new cloudwatch.Alarm(this, 'OriginRequestsAlarm', {
      alarmName: 'GravyPrompts-CloudFront-HighOriginRequests',
      alarmDescription: 'Alert when cache hit rate is low (too many origin requests)',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/CloudFront',
        metricName: 'Requests',
        dimensionsMap: {
          DistributionId: this.distribution.distributionId,
        },
        statistic: 'Sum',
        period: cdk.Duration.hours(1),
      }),
      threshold: 10000, // 10k requests per hour
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    originRequestsAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));

    // Monitoring: Cache Hit Rate metric
    const cacheHitRate = new cloudwatch.MathExpression({
      expression: '(requests - misses) / requests * 100',
      label: 'Cache Hit Rate',
      usingMetrics: {
        requests: new cloudwatch.Metric({
          namespace: 'AWS/CloudFront',
          metricName: 'Requests',
          dimensionsMap: {
            DistributionId: this.distribution.distributionId,
          },
          statistic: 'Sum',
        }),
        misses: new cloudwatch.Metric({
          namespace: 'AWS/CloudFront',
          metricName: 'OriginRequests',
          dimensionsMap: {
            DistributionId: this.distribution.distributionId,
          },
          statistic: 'Sum',
        }),
      },
      period: cdk.Duration.hours(1),
    });

    // Alert if cache hit rate drops below 80%
    const cacheHitRateAlarm = new cloudwatch.Alarm(this, 'CacheHitRateAlarm', {
      alarmName: 'GravyPrompts-CloudFront-LowCacheHitRate',
      alarmDescription: 'Alert when cache hit rate drops below 80%',
      metric: cacheHitRate,
      threshold: 80,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    cacheHitRateAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertTopic));

    // Create a dashboard for monitoring
    const dashboard = new cloudwatch.Dashboard(this, 'CloudFrontDashboard', {
      dashboardName: 'GravyPrompts-CloudFront-Monitoring',
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Cache Hit Rate',
        left: [cacheHitRate],
        width: 12,
        height: 6,
      }),
      new cloudwatch.GraphWidget({
        title: 'Data Transfer (GB)',
        left: [new cloudwatch.Metric({
          namespace: 'AWS/CloudFront',
          metricName: 'BytesDownloaded',
          dimensionsMap: {
            DistributionId: this.distribution.distributionId,
          },
          statistic: 'Sum',
          period: cdk.Duration.hours(1),
        }).with({
          statistic: 'Sum',
          label: 'Data Transfer',
          period: cdk.Duration.hours(1),
        })],
        width: 12,
        height: 6,
      }),
    );

    // Output the distribution URL
    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });

    new cdk.CfnOutput(this, 'AlertTopicArn', {
      value: alertTopic.topicArn,
      description: 'SNS Topic for CloudFront alerts - subscribe your email!',
    });
  }
}