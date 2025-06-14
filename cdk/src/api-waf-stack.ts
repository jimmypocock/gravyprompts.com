import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';

export interface ApiWafStackProps extends StackProps {
  api: apigateway.RestApi;
}

export class ApiWafStack extends Stack {
  public readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: ApiWafStackProps) {
    super(scope, id, props);

    // Create IP rate-based rule for API Gateway
    const rateLimitRule: wafv2.CfnWebACL.RuleProperty = {
      name: 'APIRateLimitRule',
      priority: 1,
      action: {
        block: {}
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'APIRateLimitRule',
      },
      statement: {
        rateBasedStatement: {
          limit: 100, // 100 requests per 5 minutes per IP (more restrictive for API)
          aggregateKeyType: 'IP',
        },
      },
    };

    // Size constraint rule - limit request body size
    const sizeConstraintRule: wafv2.CfnWebACL.RuleProperty = {
      name: 'RequestSizeLimit',
      priority: 2,
      action: {
        block: {}
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'RequestSizeLimit',
      },
      statement: {
        sizeConstraintStatement: {
          fieldToMatch: {
            body: {}
          },
          comparisonOperator: 'GT',
          size: 102400, // 100KB limit
          textTransformations: [{
            priority: 0,
            type: 'NONE'
          }]
        }
      }
    };

    // AWS Managed Rules - Common Rule Set
    const awsManagedRulesCommonRuleSet: wafv2.CfnWebACL.RuleProperty = {
      name: 'AWS-AWSManagedRulesCommonRuleSet',
      priority: 3,
      overrideAction: {
        none: {}
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWS-AWSManagedRulesCommonRuleSet',
      },
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesCommonRuleSet',
          excludedRules: [
            { name: 'SizeRestrictions_BODY' }, // We have our own size limit
            { name: 'GenericRFI_BODY' }, // May block legitimate JSON
          ]
        },
      },
    };

    // AWS Managed Rules - Known Bad Inputs
    const awsManagedRulesKnownBadInputsRuleSet: wafv2.CfnWebACL.RuleProperty = {
      name: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
      priority: 4,
      overrideAction: {
        none: {}
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: 'AWS-AWSManagedRulesKnownBadInputsRuleSet',
      },
      statement: {
        managedRuleGroupStatement: {
          vendorName: 'AWS',
          name: 'AWSManagedRulesKnownBadInputsRuleSet',
        },
      },
    };

    // Create Web ACL for API Gateway (REGIONAL scope)
    this.webAcl = new wafv2.CfnWebACL(this, 'ApiWebAcl', {
      scope: 'REGIONAL', // Must be REGIONAL for API Gateway
      defaultAction: {
        allow: {}
      },
      rules: [
        rateLimitRule,
        sizeConstraintRule,
        awsManagedRulesCommonRuleSet,
        awsManagedRulesKnownBadInputsRuleSet,
      ],
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: `${this.stackName}-ApiWebAcl`,
      },
    });

    // Associate WAF with API Gateway
    new wafv2.CfnWebACLAssociation(this, 'ApiWebAclAssociation', {
      resourceArn: `arn:aws:apigateway:${this.region}::/restapis/${props.api.restApiId}/stages/${props.api.deploymentStage.stageName}`,
      webAclArn: this.webAcl.attrArn,
    });

    // Outputs
    new CfnOutput(this, 'ApiWebAclArn', {
      value: this.webAcl.attrArn,
      description: 'API WAF Web ACL ARN',
      exportName: `${this.stackName}-ApiWebAclArn`,
    });

    new CfnOutput(this, 'ApiWebAclId', {
      value: this.webAcl.attrId,
      description: 'API WAF Web ACL ID',
      exportName: `${this.stackName}-ApiWebAclId`,
    });
  }
}