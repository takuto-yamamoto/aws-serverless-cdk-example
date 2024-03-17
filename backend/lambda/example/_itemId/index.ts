import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const addCorsHeaders = (response: APIGatewayProxyResult) => ({
  ...response,
  headers: {
    ...response.headers,
    'Access-Control-Allow-Origin': '*',
  },
});

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const httpMethod = event.httpMethod;
  const itemId = event.pathParameters?.itemId;
  const tableName = process.env.TABLE_NAME;

  if (!itemId) {
    return addCorsHeaders({
      statusCode: 400,
      body: JSON.stringify(
        'リクエストのパスパラメータにアイテムIDが存在しません'
      ),
    });
  }

  if (!tableName) {
    return addCorsHeaders({
      statusCode: 500,
      body: JSON.stringify('環境変数にテーブル名が登録されていません'),
    });
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

      return addCorsHeaders({
        statusCode: 200,
        body: JSON.stringify(response.Item),
      });
    } else if (httpMethod === 'PUT') {
      const newItem = {
        itemId,
        description: `${itemId}番目のアイテム`,
      };
      await documentClient.send(
        new PutCommand({ TableName: tableName, Item: newItem })
      );

      return addCorsHeaders({
        statusCode: 200,
        body: JSON.stringify(newItem),
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
