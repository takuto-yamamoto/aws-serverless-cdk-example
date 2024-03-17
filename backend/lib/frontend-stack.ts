import {
  Stack,
  StackProps,
  Duration,
  RemovalPolicy,
  aws_iam as iam,
  aws_s3 as s3,
  aws_s3_deployment as s3Deploy,
  aws_cloudfront as cloudfront,
  aws_cloudfront_origins as cloudfrontOrigins,
} from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ExampleFrontendStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const ENV = this.node.tryGetContext('CDK_ENV');

    // S3 Log Bucket
    const logBucket = new s3.Bucket(this, 'LogsBucket', {
      bucketName: `example-${ENV}-logs`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.OBJECT_WRITER,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // S3 Website Bucket
    const websiteBucket = new s3.Bucket(this, 'WebsiteBucket', {
      bucketName: `example-${ENV}-website`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      encryption: s3.BucketEncryption.S3_MANAGED,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    // Application Deployment
    new s3Deploy.BucketDeployment(this, 'ApplicationDeploy', {
      sources: [s3Deploy.Source.asset('../../frontend/dist')],
      destinationBucket: websiteBucket,
    });

    // CloudFront Website OAC
    const websiteOAC = new cloudfront.CfnOriginAccessControl(
      this,
      'WebsiteOAC',
      {
        originAccessControlConfig: {
          name: `example-${ENV}-website-OAC`,
          originAccessControlOriginType: 's3',
          signingBehavior: 'always',
          signingProtocol: 'sigv4',
          description: `example-${ENV}-website-OAC`,
        },
      }
    );

    // CloudFront Website Distribution
    const websiteDistro = new cloudfront.Distribution(this, 'WebsiteDistro', {
      comment: `example-${ENV}-website-distribution`,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: new cloudfrontOrigins.S3Origin(websiteBucket),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 403,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 403,
          responsePagePath: '/index.html',
          ttl: Duration.minutes(5),
        },
      ],
      enableLogging: true,
      logBucket: logBucket,
      logFilePrefix: 'website-access-logs',
    });

    // S3 Website Bucket Policy
    const websiteBucketPolicy = new iam.PolicyStatement({
      actions: ['s3:GetObject'],
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      resources: [`${websiteBucket.bucketArn}/*`],
    });
    websiteBucketPolicy.addCondition('StringEquals', {
      'AWS:SourceArn': `arn:aws:cloudfront::${Stack.of(this).account}:distribution/${websiteDistro.distributionId}`, // prettier-ignore
    });
    websiteBucket.addToResourcePolicy(websiteBucketPolicy);

    // CloudFront OAC Properties
    const websiteCfnDistro = websiteDistro.node.defaultChild as cloudfront.CfnDistribution; // prettier-ignore
    // 勝手に追加されるOAI属性の削除
    websiteCfnDistro.addPropertyOverride(
      'DistributionConfig.Origins.0.S3OriginConfig.OriginAccessIdentity',
      ''
    );
    // OAC属性の追加
    websiteCfnDistro.addPropertyOverride(
      'DistributionConfig.Origins.0.OriginAccessControlId',
      websiteOAC.attrId
    );
  }
}
