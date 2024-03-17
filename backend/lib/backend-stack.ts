import * as path from 'path';

import {
  Stack,
  StackProps,
  RemovalPolicy,
  aws_apigateway as apigw,
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_lambda as lambda,
  aws_logs as logs,
} from 'aws-cdk-lib';
import { OAuthScope } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export class ExampleBackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const ENV = this.node.tryGetContext('CDK_ENV');

    // Cognito
    const userPool = new cognito.UserPool(this, 'ExampleUserPool', {
      userPoolName: `example-${ENV}-user-pool`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    userPool.addClient('ExampleUserPoolClient', {
      userPoolClientName: `example-${ENV}-user-pool-client`,
      authFlows: {
        adminUserPassword: true,
        userSrp: true,
      },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          OAuthScope.PHONE,
          OAuthScope.EMAIL,
          OAuthScope.OPENID,
          OAuthScope.PROFILE,
        ],
      },
    });

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
    const exampleItemIdLambda = new lambda.Function(
      this,
      'ExampleItemIdLambda',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(
          path.join(__dirname, '../lambda/dist/example/_itemId')
        ),
        environment: {
          TABLE_NAME: exampleTable.tableName,
        },
      }
    );
    exampleTable.grantReadWriteData(exampleItemIdLambda);

    // API Gateway
    const restApiAccessLogGroup = new logs.LogGroup(
      this,
      'ExampleAPIGatewayAccessLog',
      {
        logGroupName: `/aws/apigateway/${ENV}/example/rest-api-access-logs`,
        retention: 365,
      }
    );
    const restApi = new apigw.RestApi(this, 'ExampleAPIGateway', {
      endpointTypes: [apigw.EndpointType.EDGE],
      restApiName: `example-${ENV}-apigateway`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      cloudWatchRole: true,
      deployOptions: {
        stageName: `${ENV}`,
        dataTraceEnabled: true,
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        accessLogDestination: new apigw.LogGroupLogDestination(
          restApiAccessLogGroup
        ),
        accessLogFormat: apigw.AccessLogFormat.clf(),
      },
    });

    // API Gateway と Lambda の統合
    // root
    const apiV1 = restApi.root.addResource('api').addResource('v1');
    // /example
    const exampleResource = apiV1.addResource('example');
    // /example/{itemId}
    const exampleItemIdResource = exampleResource.addResource('{itemId}');
    const exampleItemIdIntegration = new apigw.LambdaIntegration(
      exampleItemIdLambda
    );
    exampleItemIdResource.addMethod('GET', exampleItemIdIntegration);
    exampleItemIdResource.addMethod('PUT', exampleItemIdIntegration);
  }
}
