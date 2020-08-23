import dotenv from 'dotenv-safe';
import mysql from 'mysql2/promise';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { initDbConnection, getDbPool } from '../utils/database';
import { createTask, getTasks, removeTask } from '../utils/monitoring';

chai.use(chaiAsPromised);
chai.should();

describe('monitoring tasks', () => {
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

  describe('createTask', () => {
    it('should be able to create a task', async () => {
      await createTask(endpointId, false).should.be.fulfilled;
      const tasks = getTasks();
      const task = tasks.get(endpointId);
      if (!task) {
        throw new Error('new task was not added to the tasks object');
      }
      chai.expect(() => { removeTask(endpointId, false); }).to.not.throw();
    });

    it('should check the associated endpoint right after a task was created', async () => {
      let [rows] = await pool.execute(
        'select count(id) as amount from MonitoringResults where monitoredEndpointId = ?',
        [endpointId],
      ).should.be.fulfilled;

      let result = JSON.parse(JSON.stringify(rows));
      const amountBefore = result[0].amount;

      await createTask(endpointId, false).should.be.fulfilled;
      const task = getTasks().get(endpointId);
      if (!task) {
        throw new Error('new task was not added to the tasks object');
      }
      chai.expect(() => { removeTask(endpointId, false); }).to.not.throw();

      [rows] = await pool.execute(
        'select count(id) as amount from MonitoringResults where monitoredEndpointId = ?',
        [endpointId],
      ).should.be.fulfilled;

      result = JSON.parse(JSON.stringify(rows));
      const amountAfter = result[0].amount;

      chai.assert.equal(
        amountAfter,
        amountBefore + 1,
        'expected to see 1 new monitoring result right after adding new task',
      );
    });

    it('should fail to create a task for non-existing endpoint', async () => {
      await createTask(NaN, false).should.be.rejected;
    });
  });

  describe('removeTask', () => {
    it('should be able to remove a task that was created', async () => {
      const tasks = getTasks();
      await createTask(endpointId, false).should.be.fulfilled;
      if (!tasks.has(endpointId)) {
        throw new Error('new task was not added to the tasks object');
      }
      chai.expect(() => { removeTask(endpointId, false); }).to.not.throw();
      if (tasks.has(endpointId)) {
        throw new Error('new task was not removed from the tasks object');
      }
    });

    it('should fail to remove a non-existing task', () => {
      chai.expect(() => { removeTask(NaN, false); }).to.throw();
    });
  });
});
