import restify from 'restify';
import { ResourceNotFoundError, InvalidArgumentError } from 'restify-errors';
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
    res.send(200, { data: rows });
  } catch (e) {
    let httpCode: number;
    switch (e.name) {
      case 'InvalidCredentialsError':
        httpCode = 401;
        break;
      default:
        httpCode = 500;
        break;
    }
    res.send(httpCode, { error: e.message });
  }
  next();
}

export async function getEndpointResultsHandler(
  req: restify.Request,
  res: restify.Response,
  next:restify.Next,
): Promise<void> {
  try {
    const userId = await getUserIdFromAccessToken(req.headers['access-token']);
    const connection = getDbConnection();
    const [rows] = await connection.execute(
      'select mr.* from MonitoredEndpoints me left join MonitoringResults mr on me.id = mr.monitoredEndpointId where me.id = ? and ownerId = ? order by checkedDate desc limit 10',
      [req.params.id, userId],
    );
    let result = JSON.parse(JSON.stringify(rows));

    if (result.length === 0) {
      throw new ResourceNotFoundError(`id ${req.params.id} doesn't correspond to any of your endpoints`);
    }

    if (result[0].id === null) {
      result = [];
    }

    res.send(200, { data: result });
  } catch (e) {
    let httpCode: number;
    switch (e.name) {
      case 'InvalidCredentialsError':
        httpCode = 401;
        break;
      case 'ResourceNotFoundError':
        httpCode = 404;
        break;
      default:
        httpCode = 500;
        break;
    }
    res.send(httpCode, { error: e.message });
  }
  next();
}
