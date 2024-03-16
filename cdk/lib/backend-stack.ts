import * as path from 'path';

import {
  Stack,
  StackProps,
  RemovalPolicy,
  aws_apigateway as apigw,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ExampleBackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const ENV = this.node.tryGetContext('CDK_ENV');

    // DynamoDB
    const exampleTable = new dynamodb.Table(this, 'ExampleTable', {
      partitionKey: {
        name: 'itemId',
        type: dynamodb.AttributeType.STRING,
      },
      tableName: `${ENV}-example-table`,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Lambda
    const exampleLambda = new lambda.Function(this, 'ExampleLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../../lambda/dist/example')
      ),
      environment: {
        TABLE_NAME: exampleTable.tableName,
      },
    });
    exampleTable.grantReadData(exampleLambda);

    // API Gateway
    const restApi = new apigw.RestApi(this, 'ExampleAPIGateway', {
      endpointTypes: [apigw.EndpointType.EDGE],
      restApiName: `example-${ENV}-apigw`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      deployOptions: { stageName: `${ENV}` },
    });

    // API Gateway と Lambda の統合
    const apiV1 = restApi.root.addResource('api').addResource('v1');
    apiV1
      .addResource('example')
      .addResource('{itemId}')
      .addMethod('GET', new apigw.LambdaIntegration(exampleLambda));
  }
}
