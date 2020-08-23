import dotenv from 'dotenv-safe';
import mysql from 'mysql2/promise';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { initDbConnection, getDbPool } from '../utils/database';
import getUserIdFromAcessToken from '../utils/auth';

chai.use(chaiAsPromised);
chai.should();

describe('authentication', () => {
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
      'delete from MonitoringResults where monitoredEndpointId in (select id from MonitoredEndpoints where ownerId = ?)',
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

  describe('getUserIdFromAccessToken', () => {
    it('should return testing user\'s id when presented with their token', async () => {
      const result = await getUserIdFromAcessToken('testing-token').should.be.fulfilled;
      chai.assert.equal(result, userId);
    });

    it('should fail for non-existing access token', async () => {
      let token = '';
      for (let i = 0; i < 500; i += 1) {
        token += 'a';
      }
      await getUserIdFromAcessToken(token).should.be.rejected;
    });

    it('should fail for access token of type undefined', async () => {
      await getUserIdFromAcessToken(undefined).should.be.rejected;
    });

    it('should fail for access token of type string[]', async () => {
      await getUserIdFromAcessToken(['first_token', 'second_token']).should.be.rejected;
    });
  });
});
