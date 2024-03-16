import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ExampleBackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const ENV = this.node.tryGetContext('CDK_ENV');
  }
}
