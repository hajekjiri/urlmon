import { getDbConnection } from './database';
import MonitoredEndpoint from '../models/monitoredEndpoint';

const tasks = new Map<number, NodeJS.Timeout>();

export async function initializeTasks(): Promise<void> {
  const connection = getDbConnection();
  const [rows] = await connection.execute('select * from MonitoredEndpoints');
  const result = JSON.parse(JSON.stringify(rows));

  for (let i = 0; i < result.length; i += 1) {
    const endpoint = new MonitoredEndpoint(
      result[i].id,
      result[i].name,
      result[i].url,
      result[i].createdDate,
      result[i].monitoringInterval,
      result[i].ownerId,
    );

    if (endpoint.id === null) {
      throw new Error('cannot initialize task for endpoint with null id');
    }

    endpoint.check();
    tasks.set(
      endpoint.id,
      setInterval(() => { endpoint.check(); }, endpoint.monitoringInterval * 1000),
    );
  }
  console.log('Initialized all tasks for all existing endpoints');
}

export function removeTask(id: number): void {
  const t = tasks.get(id);
  if (t === undefined) {
    throw new Error(`cannot remove task - there is no active task with id ${id}`);
  }
  clearTimeout(t);
  console.log(`Removed task #${id}`);
}

export async function createTask(id: number): Promise<void> {
  const connection = getDbConnection();

  const [rows] = await connection.execute(
    'select * from MonitoredEndpoints where id = ? limit 1', [id],
  );
  const result = JSON.parse(JSON.stringify(rows))[0];
  const endpoint = new MonitoredEndpoint(
    result.id,
    result.name,
    result.url,
    result.createdDate,
    result.monitoringInterval,
    result.ownerId,
  );

  if (endpoint.id === null) {
    throw new Error('cannot initialize task for endpoint with null id');
  }

  endpoint.check();
  tasks.set(
    endpoint.id,
    setInterval(() => { endpoint.check(); }, endpoint.monitoringInterval * 1000),
  );

  console.log(`Created task #${endpoint.id} | ${endpoint.name} | ${endpoint.url}`);
}
