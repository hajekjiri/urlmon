import restify from 'restify';
import { getDbConnection } from './database';
import getUserIdFromAccessToken from './auth';

export async function getEndpointsHandler(
  req: restify.Request,
  res: restify.Response,
  next:restify.Next,
): Promise<void> {
  try {
    const userId = await getUserIdFromAccessToken(req.headers['access-token']);
    const connection = getDbConnection();
    const [rows] = await connection.execute(
      'select * from MonitoredEndpoints where ownerId = ?',
      [userId],
    );
    res.send({ data: rows });
  } catch (e) {
    res.send({
      error: e.message,
    });
  }
  next();
}
