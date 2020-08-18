import { getDbConnection } from '../utils/database';

export default class MonitoringResult {
  checkedDate: Date;

  httpCode: number;

  payloadFile: string;

  monitoredEndpointId: number;

  constructor(httpCode: number,
    payloadFile: string,
    monitoredEndpointId: number) {
    this.checkedDate = new Date();
    this.httpCode = httpCode;
    this.payloadFile = payloadFile;
    this.monitoredEndpointId = monitoredEndpointId;
  }

  async validate(): Promise<void> {
    const validHttpCodes = new Set<number>([
      100, 101, 200, 201, 202, 203, 204, 205, 206, 300, 301, 302, 303, 304, 305, 307, 400, 401,
      402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 426, 500,
      501, 502, 503, 504, 505,
    ]);

    if (!validHttpCodes.has(this.httpCode)) {
      throw new Error(`${this.httpCode} is not a valid http code`);
    }

    if (this.payloadFile.length > 100) {
      throw new Error('name of the payload file must not exceed 100 characters');
    }

    const connection = getDbConnection();
    const [rows] = await connection.execute(
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
    await this.validate();
    const connection = getDbConnection();
    await connection.execute(
      'insert into MonitoringResults values (null, ?, ?, ?, ?)',
      [this.checkedDate, this.httpCode, this.payloadFile, this.monitoredEndpointId],
    );
  }
}
