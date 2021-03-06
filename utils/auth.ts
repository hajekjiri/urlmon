import { InvalidCredentialsError } from 'restify-errors';
import { getDbPool } from './database';

export default async function getUserIdFromAcessToken(
  accessToken: string | string[] | undefined,
): Promise<number> {
  if (!accessToken) {
    throw new InvalidCredentialsError('missing accessToken header');
  }

  if (typeof accessToken === 'object') {
    throw new InvalidCredentialsError('invalid accessToken');
  }

  const pool = getDbPool();
  const [rows] = await pool.execute(
    'select id from Users where accessToken = ? limit 1',
    [accessToken],
  );
  const result = JSON.parse(JSON.stringify(rows));

  if (result.length === 0) {
    throw new InvalidCredentialsError('invalid access token');
  }
  return result[0].id;
}
