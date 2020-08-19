import { getDbConnection } from './database';

export default async function getUserIdFromAcessToken(
  accessToken: string | string[] | undefined,
): Promise<number> {
  if (accessToken === undefined) {
    throw new Error('missing accessToken header');
  }

  if (typeof accessToken === 'object') {
    throw new Error('invalid accessToken');
  }

  const connection = getDbConnection();
  const [rows] = await connection.execute(
    'select id from Users where accessToken = ? limit 1',
    [accessToken],
  );
  const result = JSON.parse(JSON.stringify(rows));

  if (result.length === 0) {
    throw new Error('invalid access token');
  }
  return result[0].id;
}
