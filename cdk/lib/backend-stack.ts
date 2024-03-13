import * as path from 'path';

import {
  Stack,
  StackProps,
  RemovalPolicy,
  aws_iam as iam,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ExampleBackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const ENV = this.node.tryGetContext('CDK_ENV');

    // dynamodb
    const exampleTable = new dynamodb.Table(this, 'ExampleTable', {
      partitionKey: {
        name: 'itemId',
        type: dynamodb.AttributeType.STRING,
      },
      tableName: `${ENV}-example-table`,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // lambda
    const exampleLambda = new lambda.Function(this, 'ExampleLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda/dist')),
      environment: {
        TABLE_NAME: exampleTable.tableName,
      },
    });
  }
}
