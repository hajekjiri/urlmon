import dotenv from 'dotenv-safe';
import mysql from 'mysql2/promise';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { initDbConnection, getDbPool } from '../utils/database';
import MonitoredEndpoint from '../models/monitoredEndpoint';

chai.use(chaiAsPromised);
chai.should();

describe('MonitoredEndpoint', () => {
  let pool: mysql.Pool;
  let userId: number;

  before(async () => {
    // initialize database connection pool
    dotenv.config();
    await initDbConnection().should.be.fulfilled;
    pool = getDbPool();

    // create testing user
    const [info] = await pool.execute(
      'insert into Users values (null, \'testing\', \'testing@user.xyz\', \'testing-token\')',
    ).catch((e) => {
      throw new Error(`failed to insert testing user to database: ${e.message}`);
    });
    const result = JSON.parse(JSON.stringify(info));
    userId = result.insertId;
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
    it('should succeed for name of random valid length and other valid parameters', async () => {
      const randomValidLength = Math.floor(Math.random() * (100 - 3 + 1) + 3);
      let name = '';
      for (let i = 0; i < randomValidLength; i += 1) {
        name += 'a';
      }
      const endpoint = new MonitoredEndpoint(
        null,
        name,
        'https://github.com',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.validate().should.be.fulfilled;
    });

    it('should fail for name shorter than 3 characters', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'Te',
        'https://github.com',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.validate().should.be.rejected;
    });

    it('should fail for name longer than 100 characters', async () => {
      let longName: string = '';
      for (let i = 0; i < 101; i += 1) {
        longName += 'a';
      }
      const endpoint = new MonitoredEndpoint(
        null,
        longName,
        'https://github.com',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.validate().should.be.rejected;
    });

    it('should succeed for http url and other valid parameters', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'Testing endpoint',
        'http://github.com',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.validate().should.be.fulfilled;
    });

    it('should succeed for https url and other valid parameters', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'Testing endpoint',
        'https://github.com',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.validate().should.be.fulfilled;
    });

    it('should fail for ftp url', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'FTP endpoint',
        'ftp://username:password@ftp.fakesite.org/',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.validate().should.be.rejected;
    });

    it('should fail for url without protocol', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'endpoint without protocol',
        'applifting.cz',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.validate().should.be.rejected;
    });

    it('should succeed for monitoring interval of 60 seconds or longer', async () => {
      const endpoint60 = new MonitoredEndpoint(
        null,
        'endpoint with interval of 60 seconds',
        'https://applifting.cz',
        new Date(),
        null,
        60,
        userId,
      );
      await endpoint60.validate().should.be.fulfilled;

      const endpoint61 = new MonitoredEndpoint(
        null,
        'endpoint with interval of 60 seconds',
        'https://applifting.cz',
        new Date(),
        null,
        61,
        userId,
      );
      await endpoint61.validate().should.be.fulfilled;

      const endpoint1337 = new MonitoredEndpoint(
        null,
        'endpoint with interval of 1337 seconds',
        'https://applifting.cz',
        new Date(),
        null,
        1337,
        userId,
      );
      await endpoint1337.validate().should.be.fulfilled;
    });

    it('should fail for monitoring interval shorter than 60 seconds', async () => {
      const endpointNegative20 = new MonitoredEndpoint(
        null,
        'endpoint with interval of -20 seconds',
        'https://applifting.cz',
        new Date(),
        null,
        -20,
        userId,
      );
      await endpointNegative20.validate().should.be.rejected;

      const endpoint0 = new MonitoredEndpoint(
        null,
        'endpoint with interval of 0 seconds',
        'https://applifting.cz',
        new Date(),
        null,
        0,
        userId,
      );
      await endpoint0.validate().should.be.rejected;

      const endpoint59 = new MonitoredEndpoint(
        null,
        'endpoint with interval of 59 seconds',
        'https://applifting.cz',
        new Date(),
        null,
        59,
        userId,
      );
      await endpoint59.validate().should.be.rejected;
    });

    it('should succeed for ownerId of existing user and other valid parameters', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'GitHub',
        'https://github.com',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.validate().should.be.fulfilled;
    });

    it('should fail for ownerId of non-existing user', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'GitHub',
        'https://github.com',
        new Date(),
        null,
        120,
        NaN,
      );
      await endpoint.validate().should.be.rejected;
    });
  });

  describe('saving to database', () => {
    it('should succeed for a valid endpoint', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'Testing endpoint',
        'https://github.com',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.save().should.be.fulfilled;
    });

    it('should update the id property once saved', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'Testing endpoint',
        'https://github.com',
        new Date(),
        null,
        120,
        userId,
      );
      if (endpoint.id !== null) {
        throw new Error(`expected endpoint id (${endpoint.id}) to be null before saving`);
      }
      await endpoint.save().should.be.fulfilled;
      chai.assert.typeOf(endpoint.id, 'number');
    });

    it('should fail for an invalid endpoint', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'Te',
        'github.com',
        new Date(),
        null,
        20,
        userId,
      );
      await endpoint.save().should.be.rejected;
    });

    it('should fail if id is not null', async () => {
      const endpoint = new MonitoredEndpoint(
        1,
        'Testing endpoint',
        'https://github.com',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.save().should.be.rejected;
    });
  });

  describe('monitoring', () => {
    it('should create a monitoring result', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'Testing endpoint',
        'https://github.com',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.save().should.be.fulfilled;

      let [rows] = await pool.execute(
        'select id from MonitoringResults where monitoredEndpointId = ?',
        [endpoint.id],
      ).should.be.fulfilled;
      let result = JSON.parse(JSON.stringify(rows));
      chai.assert.lengthOf(result, 0, 'expected 0 results before checking for the first time');

      await endpoint.check(false).should.be.fulfilled;

      [rows] = await pool.execute(
        'select id from MonitoringResults where monitoredEndpointId = ?',
        [endpoint.id],
      ).should.be.fulfilled;
      result = JSON.parse(JSON.stringify(rows));
      chai.assert.lengthOf(result, 1, 'expected 1 result after checking for the first time');
    });

    it('should update lastCheckedDate', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'Testing endpoint',
        'https://github.com',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.save().should.be.fulfilled;
      await endpoint.check(false).should.be.fulfilled;

      const [rows] = await pool.execute(
        'select lastCheckedDate from MonitoredEndpoints where id = ? limit 1',
        [endpoint.id],
      );
      const result = JSON.parse(JSON.stringify(rows));
      chai.assert.lengthOf(result, 1, 'expected to find saved endpoint in database');
      if (!result[0].lastCheckedDate) {
        throw new Error('expected check() to update lastCheckedDate');
      }
    });

    it('should fail for non-existing endpoint', async () => {
      const endpoint = new MonitoredEndpoint(
        -1,
        'Testing endpoint',
        'https://github.com',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.check(false).should.be.rejected;
    });

    it('should fail for endpoint with null id', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'Testing endpoint',
        'https://github.com',
        new Date(),
        null,
        120,
        userId,
      );
      await endpoint.check(false).should.be.rejected;
    });
  });
});
