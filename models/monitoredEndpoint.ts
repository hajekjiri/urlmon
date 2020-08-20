import axios from 'axios';
import urllib from 'url';
import { InvalidArgumentError } from 'restify-errors';
import MonitoringResult from './monitoringResult';
import { getDbConnection } from '../utils/database';

export default class MonitoredEndpoint {
  id: number | null;

  name: string;

  url: string;

  createdDate: Date;

  monitoringInterval: number;

  ownerId: number;

  constructor(id: number | null,
    name: string,
    url: string,
    createdDate: Date,
    monitoringInterval: number,
    ownerId: number) {
    this.id = id;
    this.name = name;
    this.url = url;
    this.createdDate = createdDate;
    this.monitoringInterval = monitoringInterval;
    this.ownerId = ownerId;
  }

  async validate(): Promise<void> {
    if (this.name.length > 100) {
      throw new InvalidArgumentError('name of the endpoint must not exceed 100 characters');
    }

    if (this.name.length > 100) {
      throw new InvalidArgumentError('url of the endpoint must not exceed 100 characters');
    }

    const parsedUrl = urllib.parse(this.url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new InvalidArgumentError('invalid protocol - only http and https are supported');
    }

    if (this.monitoringInterval < 60) {
      throw new InvalidArgumentError('monitoringInterval must not be shorter than 60 seconds');
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
    if (this.id !== null) {
      throw new Error('cannot save MonitoredEndpoint with non-null id');
    }
    await this.validate();
    const connection = getDbConnection();
    const [info] = await connection.execute(
      'insert into MonitoredEndpoints values (null, ?, ?, ?, null, ?, ?)',
      [this.name, this.url, this.createdDate, this.monitoringInterval, this.ownerId],
    );
    const result = JSON.parse(JSON.stringify(info));
    this.id = result.insertId;
  }

  async check(): Promise<void> {
    if (this.id === null) {
      throw new Error('cannot check MonitoredEndpoint with null id');
    }
    console.log(`[${new Date().toISOString()}] Checking #${this.id} | ${this.name} | ${this.url} ...`);

    const date = new Date();
    let errorMessage: string | null = null;
    const result = await axios.get(this.url).catch((e) => {
      errorMessage = e.toString();
    });

    let httpCode: number | null = null;
    let payload: string | null = null;
    let contentType: string | null = null;
    if (result) {
      httpCode = result.status;
      payload = result.data;
      contentType = result.headers['content-type'];
    }

    const monitoringResult = new MonitoringResult(
      null,
      date,
      httpCode,
      contentType,
      payload,
      errorMessage,
      this.id,
    );

    await monitoringResult.save();

    const connection = getDbConnection();
    connection.execute(
      'update MonitoredEndpoints set lastCheckedDate = ? where id = ?',
      [date, this.id],
    );
  }
}
