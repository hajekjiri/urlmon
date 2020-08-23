import restify from 'restify';
import { ResourceNotFoundError, InvalidArgumentError } from 'restify-errors';
import { getDbPool } from './database';
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
    const pool = getDbPool();
    const [rows] = await pool.execute(
      'select * from MonitoredEndpoints where ownerId = ?',
      [userId],
    );
    res.send(200, { data: rows });
  } catch (e) {
    let httpCode: number;
    switch (e.name) {
      case 'InvalidArgumentError':
        httpCode = 400;
        break;
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

export async function getEndpointResultsHandler(
  req: restify.Request,
  res: restify.Response,
  next:restify.Next,
): Promise<void> {
  try {
    const userId = await getUserIdFromAccessToken(req.headers['access-token']);
    const pool = getDbPool();
    const [rows] = await pool.execute(
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
      case 'InvalidArgumentError':
        httpCode = 400;
        break;
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

export async function getResultHandler(
  req: restify.Request,
  res: restify.Response,
  next:restify.Next,
): Promise<void> {
  try {
    const userId = await getUserIdFromAccessToken(req.headers['access-token']);
    const pool = getDbPool();
    const [rows] = await pool.execute(
      'select mr.* from MonitoringResults mr join MonitoredEndpoints me on mr.monitoredEndpointId = me.id where mr.id = ? and ownerId = ? limit 1',
      [req.params.id, userId],
    );
    const result = JSON.parse(JSON.stringify(rows));

    if (result.length === 0) {
      throw new ResourceNotFoundError(`id ${req.params.id} doesn't correspond to any of your results`);
    }

    res.send(200, { data: result[0] });
  } catch (e) {
    let httpCode: number;
    switch (e.name) {
      case 'InvalidArgumentError':
        httpCode = 400;
        break;
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
    if (!req.body.name) {
      throw new InvalidArgumentError('missing name field');
    }

    if (!req.body.url) {
      throw new InvalidArgumentError('missing url field');
    }

    if (!req.body.monitoringInterval) {
      throw new InvalidArgumentError('missing monitoringInterval field');
    }

    const endpoint = new MonitoredEndpoint(
      null,
      req.body.name,
      req.body.url,
      new Date(),
      null,
      Number(req.body.monitoringInterval),
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
      case 'InvalidArgumentError':
        httpCode = 400;
        break;
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

export async function deleteEndpointHandler(
  req: restify.Request,
  res: restify.Response,
  next:restify.Next,
): Promise<void> {
  try {
    const userId = await getUserIdFromAccessToken(req.headers['access-token']);

    const pool = getDbPool();

    const [rows] = await pool.execute(
      'select * from MonitoredEndpoints where id = ? and ownerId = ? limit 1',
      [req.params.id, userId],
    );

    const result = JSON.parse(JSON.stringify(rows));
    if (result.length === 0) {
      throw new ResourceNotFoundError(`id ${req.params.id} doesn't correspond to any of your endpoints`);
    }

    removeTask(Number(req.params.id));

    await pool.execute(
      'delete from MonitoringResults where monitoredEndpointId = ?',
      [req.params.id],
    );

    await pool.execute(
      'delete from MonitoredEndpoints where id = ?',
      [req.params.id],
    );

    const endpoint = new MonitoredEndpoint(
      result[0].id,
      result[0].name,
      result[0].url,
      result[0].createdDate,
      result[0].lastCheckedDate,
      result[0].monitoringInterval,
      result[0].ownerId,
    );

    res.send(200, { data: endpoint });
  } catch (e) {
    let httpCode: number;
    switch (e.name) {
      case 'InvalidArgumentError':
        httpCode = 400;
        break;
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

export async function patchEndpointHandler(
  req: restify.Request,
  res: restify.Response,
  next:restify.Next,
): Promise<void> {
  try {
    const userId = await getUserIdFromAccessToken(req.headers['access-token']);

    const pool = getDbPool();

    const [rows] = await pool.execute(
      'select * from MonitoredEndpoints where id = ? and ownerId = ? limit 1',
      [req.params.id, userId],
    );

    const result = JSON.parse(JSON.stringify(rows));
    if (result.length === 0) {
      throw new ResourceNotFoundError(`id ${req.params.id} doesn't correspond to any of your endpoints`);
    }

    const endpoint = new MonitoredEndpoint(
      result[0].id,
      result[0].name,
      result[0].url,
      result[0].createdDate,
      result[0].lastCheckedDate,
      result[0].monitoringInterval,
      result[0].ownerId,
    );

    if (req.body.name) {
      endpoint.name = req.body.name;
    }

    if (req.body.url) {
      endpoint.url = req.body.url;
    }

    if (req.body.monitoringInterval) {
      endpoint.monitoringInterval = Number(req.body.monitoringInterval);
    }

    await endpoint.validate();

    await pool.execute(
      'update MonitoredEndpoints set name = ?, url = ?, monitoringInterval = ? where id = ?',
      [endpoint.name, endpoint.url, endpoint.monitoringInterval, req.params.id],
    );

    removeTask(Number(req.params.id));
    await createTask(req.params.id);

    res.send(200, { data: endpoint });
  } catch (e) {
    let httpCode: number;
    switch (e.name) {
      case 'InvalidArgumentError':
        httpCode = 400;
        break;
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
