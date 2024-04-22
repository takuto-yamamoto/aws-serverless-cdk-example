import * as path from 'path';

import {
  Stack,
  StackProps,
  RemovalPolicy,
  aws_apigateway as apigw,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as cloudfrontOrigins,
  aws_cognito as cognito,
  aws_dynamodb as dynamodb,
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
  aws_s3 as s3,
  aws_secretsmanager as secretsmanager,
  aws_ssm as ssm,
  Duration,
} from 'aws-cdk-lib';
import { OAuthScope } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export class ExampleBackendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const ENV = this.node.tryGetContext('CDK_ENV');
    const PROJECT = 'example';
    const SSM_PUBLIC_KEY_ID = '/example/dev/jsonDistro/publicKey';
    const SM_SECRET_KEY_ID = '/example/dev/jsonDistro/privateKey';

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

    // S3
    const jsonBucket = new s3.Bucket(this, 'JSONBucket', {
      bucketName: `${PROJECT}-json-${ENV}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          allowedOrigins: ['http://localhost:5173'],
          allowedHeaders: ['*'],
        },
      ],
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: ENV === 'prod' ? false : true,
      removalPolicy:
        ENV === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    // Cloudfront
    // oac
    const jsonOAC = new cloudfront.CfnOriginAccessControl(this, 'jsonOAC', {
      originAccessControlConfig: {
        name: `${PROJECT}-json-OAC-${ENV}`,
        originAccessControlOriginType: 's3',
        signingBehavior: 'always',
        signingProtocol: 'sigv4',
        description: `${PROJECT}-json-OAC-${ENV}`,
      },
    });
    // cors
    const corsHeaderPolicy = new cloudfront.ResponseHeadersPolicy(
      this,
      'CorsHeaderPolicy',
      {
        responseHeadersPolicyName: `${PROJECT}-cors-policy-${ENV}`,
        corsBehavior: {
          accessControlAllowCredentials: true,
          accessControlAllowHeaders: [
            'Content-Type',
            'Origin',
            'Authorization',
          ],
          accessControlAllowMethods: ['GET'],
          accessControlAllowOrigins: ['http://localhost:5173'],
          accessControlExposeHeaders: ['ETag'],
          accessControlMaxAge: Duration.seconds(3000),
          originOverride: true,
        },
      }
    );
    // pubkey for signed cookies
    const pubKey = new cloudfront.PublicKey(this, 'jsonPubKey', {
      encodedKey: ssm.StringParameter.valueForStringParameter(
        this,
        SSM_PUBLIC_KEY_ID
      ),
    });
    const keyGroup = new cloudfront.KeyGroup(this, 'jsonKeyGroup', {
      items: [pubKey],
    });
    // distro
    const jsonDistro = new cloudfront.Distribution(this, 'jsonDistro', {
      comment: `${PROJECT}-json-${ENV}`,
      defaultBehavior: {
        origin: new cloudfrontOrigins.S3Origin(jsonBucket),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy: corsHeaderPolicy,
        trustedKeyGroups: [keyGroup],
      },
    });
    // 勝手に追加されるOAI属性の削除とOAC属性の追加
    const jsonCfnDistro = jsonDistro.node.defaultChild as cloudfront.CfnDistribution; // prettier-ignore
    jsonCfnDistro.addPropertyOverride(
      'DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity',
      ''
    );
    jsonCfnDistro.addPropertyOverride(
      'DistributionConfig.Origins.0.OriginAccessControlId',
      jsonOAC.attrId
    );
    // bucket policy
    const jsonBucketPolicy = new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      resources: [`${jsonBucket.bucketArn}/*`],
    });
    jsonBucketPolicy.addCondition('StringEquals', {
      'AWS:SourceArn': `arn:aws:cloudfront::${Stack.of(this).account}:distribution/${jsonDistro.distributionId}`, // prettier-ignore
    });
    jsonBucket.addToResourcePolicy(jsonBucketPolicy);

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

    const secretKey = secretsmanager.Secret.fromSecretNameV2(
      this,
      'PrivateKey',
      SM_SECRET_KEY_ID
    );
    const cookieLambda = new lambda.Function(this, 'cookieLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(
        path.join(__dirname, '../lambda/dist/cookie')
      ),
      environment: {
        JSON_DISTRIBUTION_DOMAIN: jsonDistro.domainName,
        KEY_PAIR_ID: pubKey.publicKeyId,
        SECRET_ID: secretKey.secretName,
      },
    });
    secretKey.grantRead(cookieLambda);

    // API Gateway
    // Authorizer
    const restApiAuthorizer = new apigw.CognitoUserPoolsAuthorizer(
      this,
      'RestApiAuthorizer',
      {
        cognitoUserPools: [userPool],
        authorizerName: `example-${ENV}-apigateway-authorizer`,
      }
    );
    // AccessLogGroup
    const restApiAccessLogGroup = new logs.LogGroup(
      this,
      'ExampleAPIGatewayAccessLog',
      {
        logGroupName: `/aws/apigateway/${ENV}/example/rest-api-access-logs`,
        retention: 365,
      }
    );
    // REST API
    const restApi = new apigw.RestApi(this, 'ExampleAPIGateway', {
      endpointTypes: [apigw.EndpointType.EDGE],
      restApiName: `example-${ENV}-apigateway`,
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization'],
      },
      defaultMethodOptions: {
        authorizer: restApiAuthorizer,
        authorizationType: apigw.AuthorizationType.COGNITO,
      },
      deployOptions: {
        stageName: `${ENV}`,
        dataTraceEnabled: true,
        loggingLevel: apigw.MethodLoggingLevel.INFO,
        accessLogDestination: new apigw.LogGroupLogDestination(
          restApiAccessLogGroup
        ),
        accessLogFormat: apigw.AccessLogFormat.clf(),
      },
      cloudWatchRole: true,
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
    // /cookie
    const cookieResource = apiV1.addResource('cookie');
    const cookieIntegration = new apigw.LambdaIntegration(cookieLambda);
    cookieResource.addMethod('GET', cookieIntegration);
  }
}
