import axios from 'axios';
import fs from 'fs';
import mime from 'mime-types';
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
    const result = await axios.get(this.url).catch(() => {
      console.log(`there was an error while checking #${this.id}`);
    });

    let httpCode: number | null = null;
    if (result) {
      httpCode = result.status;
    }

    const monitoringResult = new MonitoringResult(
      null,
      date,
      httpCode,
      null,
      this.id,
    );

    await monitoringResult.save();

    let payloadFileName: string | null = null;
    if (result) {
      const extension = mime.extension(result.headers['content-type']) || 'unknown';
      payloadFileName = `${monitoringResult.id}.${extension}`;
      fs.writeFile(`results/${payloadFileName}`, result.data, (err) => {
        if (err) {
          throw err;
        }
      });
    }

    const connection = getDbConnection();
    connection.execute('update MonitoringResults set payloadFile = ? where id = ?',
      [payloadFileName, monitoringResult.id]);

    connection.execute(
      'update MonitoredEndpoints set lastCheckedDate = ? where id = ?',
      [date, this.id],
    );
  }
}
