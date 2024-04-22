import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { getSignedCookies } from '@aws-sdk/cloudfront-signer';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const addCorsHeaders = (
  response: APIGatewayProxyResult
): APIGatewayProxyResult => ({
  ...response,
  headers: {
    ...(response.headers ?? {}),
    'Access-Control-Allow-Origin': '*',
  },
});

const getPrivateKey = async (secretId: string) => {
  const client = new SecretsManagerClient({ region: 'ap-northeast-1' });
  const response = await client.send(
    new GetSecretValueCommand({ SecretId: secretId })
  );

  const privateKey = Buffer.from(response.SecretBinary ?? [])
    .toString('base64')
    .replace('BEGINPRIVATEKEY', '')
    .replace('ENDPRIVATEKEY', '')
    .match(/.{1,64}/g)
    ?.join('\n');

  if (!privateKey) {
    throw new Error('秘密鍵が登録されていません');
  }

  return `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`; // prettier-ignore
};

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const httpMethod = event.httpMethod;

  const domain = process.env.JSON_DISTRIBUTION_DOMAIN;
  const keyPairId = process.env.KEY_PAIR_ID;
  const secretId = process.env.SECRET_ID;

  if (!domain || !keyPairId || !secretId) {
    console.error('環境変数が設定されていません');
    return addCorsHeaders({
      statusCode: 200,
      body: JSON.stringify('環境変数が設定されていません'),
    });
  }

  try {
    if (httpMethod === 'GET') {
      const privateKey = await getPrivateKey(secretId);
      const policy = {
        Statement: [
          {
            Resource: `https://${domain}/*`,
            Condition: {
              DateLessThan: {
                'AWS:EpochTime': Math.floor(Date.now() / 1000) + 60 * 60 * 8,
              },
            },
          },
        ],
      };

      const cookies = getSignedCookies({
        keyPairId,
        privateKey,
        policy: JSON.stringify(policy),
      });

      return addCorsHeaders({
        statusCode: 200,
        body: JSON.stringify('success'),
        multiValueHeaders: {
          'Set-Cookie': Object.entries(cookies).map(
            ([key, value]) =>
              `${key}=${value}; Path=/; Domain=${domain}; HttpOnly`
          ),
        },
      });
    } else {
      throw new Error(`不明なHTTPメソッドです: ${httpMethod}`);
    }
  } catch (error) {
    console.error(error);
    return addCorsHeaders({
      statusCode: 500,
      body: JSON.stringify(`Internal Server Error: ${error}`),
    });
  }
};
