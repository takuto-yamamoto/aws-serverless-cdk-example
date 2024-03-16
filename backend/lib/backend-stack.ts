import * as path from 'path';

import {
  Stack,
  StackProps,
  RemovalPolicy,
  aws_apigateway as apigateway,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_logs as logs,
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
        path.join(__dirname, '../lambda/dist/example')
      ),
      environment: {
        TABLE_NAME: exampleTable.tableName,
      },
    });
    exampleTable.grantReadData(exampleLambda);

    // API Gateway
    const restApiAccessLogGroup = new logs.LogGroup(
      this,
      'ExampleAPIGatewayAccessLog',
      {
        logGroupName: `/aws/apigateway/${ENV}/example/rest-api-access-logs`,
        retention: 365,
      }
    );
    const restApi = new apigateway.RestApi(this, 'ExampleAPIGateway', {
      endpointTypes: [apigateway.EndpointType.EDGE],
      restApiName: `example-${ENV}-apigateway`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      cloudWatchRole: true,
      deployOptions: {
        stageName: `${ENV}`,
        dataTraceEnabled: true,
        loggingLevel: apigateway.MethodLoggingLevel.INFO,
        accessLogDestination: new apigateway.LogGroupLogDestination(
          restApiAccessLogGroup
        ),
        accessLogFormat: apigateway.AccessLogFormat.clf(),
      },
    });

    // API Gateway と Lambda の統合
    const apiV1 = restApi.root.addResource('api').addResource('v1');
    apiV1
      .addResource('example')
      .addResource('{itemId}')
      .addMethod('GET', new apigateway.LambdaIntegration(exampleLambda));
  }
}
