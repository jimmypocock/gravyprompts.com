import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

export interface CertificateStackProps extends StackProps {
  domainName: string;
  /**
   * If provided, imports this certificate ARN.
   * If not provided, creates a new certificate.
   * Once created, always provide the ARN to avoid deletion.
   */
  certificateArn?: string;
}

export class CertificateStack extends Stack {
  public readonly certificate: acm.ICertificate;
  public readonly certificateArn: string;

  constructor(scope: Construct, id: string, props: CertificateStackProps) {
    super(scope, id, props);

    if (props.certificateArn) {
      // Import existing certificate
      this.certificate = acm.Certificate.fromCertificateArn(
        this,
        'Certificate',
        props.certificateArn
      );
      this.certificateArn = props.certificateArn;
      
      new CfnOutput(this, 'CertificateArn', {
        value: this.certificateArn,
        description: 'Imported Certificate ARN',
        exportName: `${this.stackName}-CertificateArn`,
      });
    } else {
      // Create new certificate
      const cert = new acm.Certificate(this, 'Certificate', {
        domainName: props.domainName,
        subjectAlternativeNames: [`www.${props.domainName}`],
        validation: acm.CertificateValidation.fromDns(),
      });
      
      this.certificate = cert;
      this.certificateArn = cert.certificateArn;
      
      new CfnOutput(this, 'CertificateArn', {
        value: this.certificateArn,
        description: 'Certificate ARN - SAVE THIS VALUE!',
        exportName: `${this.stackName}-CertificateArn`,
      });
      
      new CfnOutput(this, 'IMPORTANT_SAVE_ARN', {
        value: `SAVE THIS ARN TO YOUR .env FILE: CERTIFICATE_ARN=${this.certificateArn}`,
        description: 'Action required to prevent certificate deletion on next deployment',
      });
    }
  }
}