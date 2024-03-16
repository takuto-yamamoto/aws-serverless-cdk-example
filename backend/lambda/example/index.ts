import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const httpMethod = event.httpMethod;
  const itemId = event.pathParameters?.itemId;
  const tableName = process.env.TABLE_NAME;

  if (!itemId) {
    return {
      statusCode: 400,
      body: JSON.stringify(
        'リクエストのパスパラメータにアイテムIDが存在しません'
      ),
    };
  }

  if (!tableName) {
    return {
      statusCode: 500,
      body: JSON.stringify('環境変数にテーブル名が登録されていません'),
    };
  }

  const ddbClient = new DynamoDBClient({ region: 'ap-northeast-1' });
  const documentClient = DynamoDBDocumentClient.from(ddbClient);

  try {
    if (httpMethod === 'GET') {
      const response = await documentClient.send(
        new GetCommand({
          TableName: tableName,
          Key: { itemId: itemId },
        })
      );

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } else {
      throw new Error(`不明なHTTPメソッドです: ${httpMethod}`);
    }
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(`Internal Server Error: ${error}`),
    };
  }
};
