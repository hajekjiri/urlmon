import { getDbConnection } from '../utils/database';

export default class MonitoredEndpoint {
  id: number | null;

  name: string;

  url: string;

  createdDate: Date;

  monitoringInterval: number;

  ownerId: number;

  constructor(name: string,
    url: string,
    createdDate: Date,
    monitoringInterval: number,
    ownerId: number) {
    this.id = null;
    this.name = name;
    this.url = url;
    this.createdDate = createdDate;
    this.monitoringInterval = monitoringInterval;
    this.ownerId = ownerId;
  }

  async validate(): Promise<void> {
    if (this.name.length > 100) {
      throw new Error('name of the endpoint must not exceed 100 characters');
    }

    if (this.name.length > 100) {
      throw new Error('url of the endpoint must not exceed 100 characters');
    }

    if (this.monitoringInterval < 60) {
      throw new Error('monitoringInterval must not be shorter than 60 seconds');
    }

    const connection = getDbConnection();
    const [rows] = await connection.execute(
      'select id from Users where `id` = ?',
      [this.ownerId],
    );
    const result = JSON.parse(JSON.stringify(rows));
    if (result.length === 0) {
      throw new Error(
        `id ${this.ownerId} doesn't correspond to any user`,
      );
    }
  }

  async save(): Promise<void> {
    await this.validate();
    const connection = getDbConnection();
    const [info] = await connection.execute(
      'insert into MonitoredEndpoints values (null, ?, ?, ?, null, ?, ?)',
      [this.name, this.url, this.createdDate, this.monitoringInterval, this.ownerId],
    );
    const result = JSON.parse(JSON.stringify(info));
    this.id = result.insertId;
  }
}
