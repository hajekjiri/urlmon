import dotenv from 'dotenv-safe';
import mysql from 'mysql2/promise';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { initDbConnection, getDbPool } from '../utils/database';
import MonitoringResult from '../models/monitoringResult';

chai.use(chaiAsPromised);
chai.should();

describe('MonitoringResult', () => {
  let pool: mysql.Pool;
  let userId: number;
  let endpointId: number;

  before(async () => {
    // initialize database connection pool
    dotenv.config();
    await initDbConnection().should.be.fulfilled;
    pool = getDbPool();

    // create testing user
    let [info] = await pool.execute(
      'insert into Users values (null, \'testing\', \'testing@user.xyz\', \'testing-token\')',
    ).catch((e) => {
      throw new Error(`failed to insert testing user to database: ${e.message}`);
    });
    let result = JSON.parse(JSON.stringify(info));
    userId = result.insertId;

    // create testing endpoint
    [info] = await pool.execute(
      'insert into MonitoredEndpoints values (null, \'testing\', \'https://github.com\', now(), null, 60, ?)',
      [userId],
    ).catch((e) => {
      throw new Error(`failed to insert testing endpoint to database: ${e.message}`);
    });
    result = JSON.parse(JSON.stringify(info));
    endpointId = result.insertId;
  });

  after(async () => {
    // delete testing results
    await pool.execute(
      'delete from MonitoringResults where id in (select mr.id from MonitoredEndpoints me join MonitoringResults mr on me.id = mr.monitoredEndpointId where ownerId = ?)',
      [userId],
    ).catch((e) => {
      throw new Error(`failed to delete testing results from database: ${e.message}`);
    });

    // delete testing endpoints
    await pool.execute(
      'delete from MonitoredEndpoints where ownerId = ?',
      [userId],
    ).catch((e) => {
      throw new Error(`failed to delete testing endpoints from database: ${e.message}`);
    });

    // delete testing user
    await pool.execute(
      'delete from Users where id = ?',
      [userId],
    ).catch((e) => {
      throw new Error(`failed to delete testing user from database: ${e.message}`);
    });

    // close database connection pool
    pool.end();
  });

  describe('model validation', () => {
    it('should succeed for valid non-null parameters', async () => {
      const monitoringResult = new MonitoringResult(
        null,
        new Date(),
        200,
        'application/json',
        '{"some": "payload"}',
        'some error',
        endpointId,
      );

      await monitoringResult.validate().should.be.fulfilled;
    });

    it('should succeed for null httpCode and other valid parameters', async () => {
      const monitoringResult = new MonitoringResult(
        null,
        new Date(),
        null,
        'application/json',
        '{"some": "payload"}',
        'some error',
        endpointId,
      );

      await monitoringResult.validate().should.be.fulfilled;
    });

    it('should fail for invalid httpCode', async () => {
      const monitoringResult = new MonitoringResult(
        null,
        new Date(),
        299,
        'application/json',
        '{"some": "payload"}',
        'some error',
        endpointId,
      );

      await monitoringResult.validate().should.be.rejected;
    });

    it('should succeed for null contentType and other valid parameters', async () => {
      const monitoringResult = new MonitoringResult(
        null,
        new Date(),
        200,
        null,
        '{"some": "payload"}',
        'some error',
        endpointId,
      );

      await monitoringResult.validate().should.be.fulfilled;
    });

    it('should fail for invalid contentType', async () => {
      const monitoringResult = new MonitoringResult(
        null,
        new Date(),
        200,
        'non-existant-content-type',
        '{"some": "payload"}',
        'some error',
        endpointId,
      );

      await monitoringResult.validate().should.be.rejected;
    });

    it('should succeed for null payload and other valid parameters', async () => {
      const monitoringResult = new MonitoringResult(
        null,
        new Date(),
        200,
        'application/json',
        null,
        'some error',
        endpointId,
      );

      await monitoringResult.validate().should.be.fulfilled;
    });

    it('should succeed for null error and other valid parameters', async () => {
      const monitoringResult = new MonitoringResult(
        null,
        new Date(),
        200,
        'application/json',
        '{"some": "payload"}',
        null,
        endpointId,
      );

      await monitoringResult.validate().should.be.fulfilled;
    });

    it('should succeed for error longer than 200 characters and other valid parameters', async () => {
      let error = '';
      for (let i = 0; i < 500; i += 1) {
        error += 'a';
      }

      const monitoringResult = new MonitoringResult(
        null,
        new Date(),
        200,
        null,
        '{"some": "payload"}',
        error,
        endpointId,
      );

      await monitoringResult.validate().should.be.fulfilled;
    });

    it('should fail for non-existing monitoredEndpointId', async () => {
      const monitoringResult = new MonitoringResult(
        null,
        new Date(),
        200,
        'application/json',
        '{"some": "payload"}',
        null,
        -1,
      );

      await monitoringResult.validate().should.be.rejected;
    });
  });

  describe('saving to database', () => {
    it('should succeed for a valid result', async () => {
      const monitoringResult = new MonitoringResult(
        null,
        new Date(),
        200,
        'application/json',
        '{"some": "payload"}',
        null,
        endpointId,
      );

      await monitoringResult.save().should.be.fulfilled;
    });

    it('should update the id property once saved', async () => {
      const monitoringResult = new MonitoringResult(
        null,
        new Date(),
        200,
        'application/json',
        '{"some": "payload"}',
        null,
        endpointId,
      );
      if (monitoringResult.id !== null) {
        throw new Error(`expected endpoint id (${monitoringResult.id}) to be null before saving`);
      }
      await monitoringResult.save().should.be.fulfilled;
      chai.assert.typeOf(monitoringResult.id, 'number');
    });

    it('should fail for an invalid result', async () => {
      const monitoringResult = new MonitoringResult(
        null,
        new Date(),
        1337,
        'non-existant-content-type',
        '{"some": "payload"}',
        null,
        endpointId,
      );

      await monitoringResult.save().should.be.rejected;
    });

    it('should fail if id is not null', async () => {
      const monitoringResult = new MonitoringResult(
        1,
        new Date(),
        200,
        'application/json',
        '{"some": "payload"}',
        null,
        endpointId,
      );

      await monitoringResult.save().should.be.rejected;
    });
  });
});
