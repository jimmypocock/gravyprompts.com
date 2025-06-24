import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';

interface CacheStackProps extends cdk.StackProps {
  api: apigateway.RestApi;
}

export class CacheStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: CacheStackProps) {
    super(scope, id, props);

    // Create cache policies for different endpoint types
    const apiCachePolicy = new cloudfront.CachePolicy(this, 'ApiCachePolicy', {
      cachePolicyName: 'GravyPrompts-API-Cache-Policy',
      comment: 'Cache policy for GravyPrompts API endpoints',
      defaultTtl: cdk.Duration.minutes(5),
      maxTtl: cdk.Duration.hours(1),
      minTtl: cdk.Duration.seconds(0),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
        'Authorization',
        'X-Forwarded-For',
        'CloudFront-Viewer-Country',
        'CloudFront-Is-Mobile-Viewer',
        'CloudFront-Is-Tablet-Viewer',
        'CloudFront-Is-Desktop-Viewer'
      ),
      cookieBehavior: cloudfront.CacheCookieBehavior.none(),
    });

    // Specific cache policy for template listings (cached longer)
    const listingsCachePolicy = new cloudfront.CachePolicy(this, 'ListingsCachePolicy', {
      cachePolicyName: 'GravyPrompts-Listings-Cache-Policy',
      comment: 'Cache policy for template listings',
      defaultTtl: cdk.Duration.minutes(10),
      maxTtl: cdk.Duration.hours(24),
      minTtl: cdk.Duration.minutes(5),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
      queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
      headerBehavior: cloudfront.CacheHeaderBehavior.none(),
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
        cachePolicy: apiCachePolicy,
        originRequestPolicy: originRequestPolicy,
        compress: true,
      },
      additionalBehaviors: {
        '/templates': {
          origin: new origins.RestApiOrigin(props.api),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: listingsCachePolicy,
          originRequestPolicy: originRequestPolicy,
          compress: true,
        },
        '/templates/*': {
          origin: new origins.RestApiOrigin(props.api),
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: apiCachePolicy,
          originRequestPolicy: originRequestPolicy,
          compress: true,
        },
      },
      enableLogging: true,
      logBucket: undefined, // Use CloudFront default bucket
      logFilePrefix: 'cdn-logs/',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100, // Use only North America and Europe edge locations to reduce costs
    });

    // Output the distribution URL
    new cdk.CfnOutput(this, 'DistributionUrl', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'CloudFront Distribution URL',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
    });
  }
}