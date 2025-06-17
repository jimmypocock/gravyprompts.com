import {
  Stack,
  StackProps,
  CfnOutput,
  RemovalPolicy,
  Duration,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";

export interface AuthStackProps extends StackProps {
  appName: string;
  domainName: string;
  environment: "development" | "production";
}

export class AuthStack extends Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string, props: AuthStackProps) {
    super(scope, id, props);

    const isProd = props.environment === "production";
    const poolName = `${props.appName}-users`;

    // Create User Pool
    this.userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: poolName,
      selfSignUpEnabled: true,
      userVerification: {
        emailSubject: `Verify your email for ${props.appName}`,
        emailBody: `Thanks for signing up for ${props.appName}! Your verification code is {####}`,
        emailStyle: cognito.VerificationEmailStyle.CODE,
        smsMessage: `Your ${props.appName} verification code is {####}`,
      },
      signInAliases: {
        email: true,
        username: false,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        bio: new cognito.StringAttribute({
          minLen: 0,
          maxLen: 280,
          mutable: true,
        }),
        github: new cognito.StringAttribute({
          minLen: 0,
          maxLen: 100,
          mutable: true,
        }),
        twitter: new cognito.StringAttribute({
          minLen: 0,
          maxLen: 100,
          mutable: true,
        }),
        linkedin: new cognito.StringAttribute({
          minLen: 0,
          maxLen: 100,
          mutable: true,
        }),
      },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(3),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      deviceTracking: {
        challengeRequiredOnNewDevice: true,
        deviceOnlyRememberedOnUserPrompt: true,
      },
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Create App Client
    this.userPoolClient = new cognito.UserPoolClient(this, "UserPoolClient", {
      userPool: this.userPool,
      userPoolClientName: `${props.appName}-client`,
      authFlows: {
        userPassword: true,
        userSrp: true,
        custom: true,
      },
      generateSecret: false, // Don't use secret for public clients
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          emailVerified: true,
          fullname: true,
        })
        .withCustomAttributes("bio", "github", "twitter", "linkedin"),
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          fullname: true,
        })
        .withCustomAttributes("bio", "github", "twitter", "linkedin"),
    });

    // User Pool Domain removed - not needed for API-only authentication

    // Outputs
    new CfnOutput(this, "UserPoolId", {
      value: this.userPool.userPoolId,
      description: "Cognito User Pool ID",
      exportName: `${this.stackName}-UserPoolId`,
    });

    new CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClient.userPoolClientId,
      description: "Cognito User Pool Client ID",
      exportName: `${this.stackName}-UserPoolClientId`,
    });

    new CfnOutput(this, "CognitoRegion", {
      value: this.region,
      description: "AWS Region for Cognito",
      exportName: `${this.stackName}-CognitoRegion`,
    });
  }
}
