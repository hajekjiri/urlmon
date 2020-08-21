import mime from 'mime-types';
import { getDbPool } from '../utils/database';

export default class MonitoringResult {
  id: number | null;

  checkedDate: Date;

  httpCode: number | null;

  contentType: string | null;

  payload: string | null;

  error: string | null;

  monitoredEndpointId: number;

  constructor(id: number | null,
    checkedDate: Date,
    httpCode: number | null,
    contentType: string | null,
    payload: string | null,
    error: string | null,
    monitoredEndpointId: number) {
    this.id = id;
    this.checkedDate = checkedDate;
    this.httpCode = httpCode;
    this.contentType = contentType;
    this.payload = payload;
    this.error = error;
    this.monitoredEndpointId = monitoredEndpointId;
  }

  async validate(): Promise<void> {
    const validHttpCodes = new Set<number>([
      100, 101, 200, 201, 202, 203, 204, 205, 206, 300, 301, 302, 303, 304, 305, 307, 400, 401,
      402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 426, 500,
      501, 502, 503, 504, 505,
    ]);

    if (this.httpCode && !validHttpCodes.has(this.httpCode)) {
      throw new Error(`${this.httpCode} is not a valid http code`);
    }

    if (this.contentType) {
      if (!mime.extension(this.contentType)) {
        throw new Error('invalid contentType');
      }

      if (this.contentType.length > 100) {
        this.contentType = this.contentType.substr(0, 100);
      }
    }

    if (this.error && this.error.length > 200) {
      this.error = this.error.substr(0, 200);
    }

    const pool = getDbPool();
    const [rows] = await pool.execute(
      'select id from MonitoredEndpoints where `id` = ?',
      [this.monitoredEndpointId],
    );
    const result = JSON.parse(JSON.stringify(rows));
    if (result.length === 0) {
      throw new Error(
        `id ${this.monitoredEndpointId} doesn't correspond to any MonitoredEndpoint`,
      );
    }
  }

  async save(): Promise<void> {
    if (this.id !== null) {
      throw new Error('cannot save MonitoringResult with non-null id');
    }
    await this.validate();
    const pool = getDbPool();
    const [info] = await pool.execute(
      'insert into MonitoringResults values (null, ?, ?, ?, ?, ?, ?)',
      [this.checkedDate, this.httpCode, this.contentType, this.payload, this.error,
        this.monitoredEndpointId],
    );
    const result = JSON.parse(JSON.stringify(info));
    this.id = result.insertId;
  }
}
