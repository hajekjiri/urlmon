import restify from 'restify';
import { ResourceNotFoundError, InvalidArgumentError } from 'restify-errors';
import { getDbConnection } from './database';
import getUserIdFromAccessToken from './auth';
import MonitoredEndpoint from '../models/monitoredEndpoint';
import { createTask, removeTask } from './monitoring';

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

export async function postEndpointHandler(
  req: restify.Request,
  res: restify.Response,
  next:restify.Next,
): Promise<void> {
  try {
    const userId = await getUserIdFromAccessToken(req.headers['access-token']);
    if (!req.params.name) {
      throw new InvalidArgumentError('missing name field');
    }

    if (!req.params.url) {
      throw new InvalidArgumentError('missing url field');
    }

    if (!req.params.monitoringInterval) {
      throw new InvalidArgumentError('missing monitoringInterval field');
    }

    const endpoint = new MonitoredEndpoint(
      null,
      req.params.name,
      req.params.url,
      new Date(),
      Number(req.params.monitoringInterval),
      userId,
    );

    await endpoint.save();

    if (endpoint.id === null) {
      throw new Error('failed to pull id of created endpoint from database');
    }

    await createTask(endpoint.id);

    res.send(201, { data: endpoint });
  } catch (e) {
    let httpCode: number;
    switch (e.name) {
      case 'InvalidCredentialsError':
        httpCode = 401;
        break;
      case 'InvalidArgumentError':
        httpCode = 400;
        break;
      default:
        httpCode = 500;
        break;
    }
    res.send(httpCode, { error: e.message });
  }
  next();
}

export async function deleteEndpointHandler(
  req: restify.Request,
  res: restify.Response,
  next:restify.Next,
): Promise<void> {
  try {
    const userId = await getUserIdFromAccessToken(req.headers['access-token']);

    const connection = getDbConnection();

    const [rows] = await connection.execute(
      'select * from MonitoredEndpoints where id = ? and ownerId = ? limit 1',
      [req.params.id, userId],
    );

    const result = JSON.parse(JSON.stringify(rows));
    if (result.length === 0) {
      throw new ResourceNotFoundError(`id ${req.params.id} doesn't correspond to any of your endpoints`);
    }

    removeTask(Number(req.params.id));

    await connection.execute(
      'delete from MonitoringResults where monitoredEndpointId = ?',
      [req.params.id],
    );

    await connection.execute(
      'delete from MonitoredEndpoints where id = ?',
      [req.params.id],
    );

    const endpoint = new MonitoredEndpoint(
      result[0].id,
      result[0].name,
      result[0].url,
      result[0].createdDate,
      result[0].monitoringInterval,
      result[0].ownerId,
    );

    res.send(200, { data: endpoint });
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
