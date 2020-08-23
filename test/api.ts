import dotenv from 'dotenv-safe';
import mysql from 'mysql2/promise';
import chai from 'chai';
import restify from 'restify';
import chaiAsPromised from 'chai-as-promised';
import axios from 'axios';
import { initDbConnection, getDbPool } from '../utils/database';
import {
  getEndpointsHandler,
  getEndpointResultsHandler,
  getResultHandler,
  postEndpointHandler,
  deleteEndpointHandler,
  patchEndpointHandler,
} from '../utils/handlers';
import { createTask, removeTask, getTasks } from '../utils/monitoring';
import MonitoredEndpoint from '../models/monitoredEndpoint';

chai.use(chaiAsPromised);
chai.should();

describe('api', () => {
  let pool: mysql.Pool;
  let userId: number;
  let emptyUserId: number;
  let endpointId: number;
  let server: restify.Server;

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

    // create empty testing user
    [info] = await pool.execute(
      'insert into Users values (null, \'empty testing\', \'empty-testing@user.xyz\', \'empty-testing-token\')',
    ).catch((e) => {
      throw new Error(`failed to insert empty testing user to database: ${e.message}`);
    });
    result = JSON.parse(JSON.stringify(info));
    emptyUserId = result.insertId;

    // create testing endpoint
    [info] = await pool.execute(
      'insert into MonitoredEndpoints values (null, \'testing\', \'https://github.com\', now(), null, 60, ?)',
      [userId],
    ).catch((e) => {
      throw new Error(`failed to insert testing endpoint to database: ${e.message}`);
    });
    result = JSON.parse(JSON.stringify(info));
    endpointId = result.insertId;

    // create a testing server
    server = restify.createServer({
      name: 'testing api',
    });
    server.use(restify.plugins.bodyParser());
    server.get('/endpoints', getEndpointsHandler);
    server.get('/endpoint/:id/results', getEndpointResultsHandler);
    server.get('/result/:id', getResultHandler);
    server.post('/endpoint', postEndpointHandler);
    server.del('/endpoint/:id', deleteEndpointHandler);
    server.patch('/endpoint/:id', patchEndpointHandler);
    await server.listen(5001);
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

    // delete testing user
    await pool.execute(
      'delete from Users where id = ?',
      [emptyUserId],
    ).catch((e) => {
      throw new Error(`failed to delete empty testing user from database: ${e.message}`);
    });

    // close database connection pool
    pool.end();

    // shut down the testing server
    server.close();
  });

  describe('GET /endpoints', () => {
    it('should fail with code 401 when the access-token header is missing', async () => {
      let error: any;
      await axios.get('http://localhost:5001/endpoints')
        .catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 401, 'expected http code 401/Unauthorized');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should fail with code 401 when the access-token header is invalid', async () => {
      let error: any;
      await axios.get(
        'http://localhost:5001/endpoints',
        { headers: { 'access-token': 'invalid-token' } },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 401, 'expected http code 401/Unauthorized');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should return 0 endpoints for user with no endpoints', async () => {
      const response = await axios.get(
        'http://localhost:5001/endpoints',
        { headers: { 'access-token': 'empty-testing-token' } },
      ).should.be.fulfilled;
      chai.assert.equal(response.status, 200, 'expected http code 200/OK');

      const body = response.data;
      if (!('data' in body)) {
        throw new Error('expected response to contain data');
      }
      chai.assert.lengthOf(response.data.data, 0);
    });

    it('should return 1 endpoint for user with 1 endpoint', async () => {
      const response = await axios.get(
        'http://localhost:5001/endpoints',
        { headers: { 'access-token': 'testing-token' } },
      ).should.be.fulfilled;
      chai.assert.equal(response.status, 200, 'expected http code 200/OK');

      const body = response.data;
      if (!('data' in body)) {
        throw new Error('expected response to contain data');
      }
      chai.assert.lengthOf(response.data.data, 1);
    });
  });

  describe('GET /endpoint/:id/results', () => {
    it('should fail with code 401 when the access-token header is missing', async () => {
      let error: any;
      await axios.get(`http://localhost:5001/endpoint/${endpointId}/results`)
        .catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 401, 'expected http code 401/Unauthorized');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should fail with code 401 when the access-token header is invalid', async () => {
      let error: any;
      await axios.get(
        `http://localhost:5001/endpoint/${endpointId}/results`,
        { headers: { 'access-token': 'invalid-token' } },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 401, 'expected http code 401/Unauthorized');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should return 0 results for endpoint with no results', async () => {
      const response = await axios.get(
        `http://localhost:5001/endpoint/${endpointId}/results`,
        { headers: { 'access-token': 'testing-token' } },
      ).should.be.fulfilled;
      chai.assert.equal(response.status, 200, 'expected http code 200/OK');

      const body = response.data;
      if (!('data' in body)) {
        throw new Error('expected response to contain data');
      }
      chai.assert.lengthOf(response.data.data, 0);
    });

    it('should return 1 result for endpoint that we check once', async () => {
      await createTask(endpointId, false).should.be.fulfilled;
      removeTask(endpointId);

      const response = await axios.get(
        `http://localhost:5001/endpoint/${endpointId}/results`,
        { headers: { 'access-token': 'testing-token' } },
      ).should.be.fulfilled;
      chai.assert.equal(response.status, 200, 'expected http code 200/OK');

      const body = response.data;
      if (!('data' in body)) {
        throw new Error('expected response to contain data');
      }
      chai.assert.lengthOf(response.data.data, 1);

      await pool.execute(
        'delete from MonitoringResults where monitoredEndpointId = ?',
        [endpointId],
      ).should.be.fulfilled;
    });

    it('should return an error for non-existing endpoint', async () => {
      let error: any;
      await axios.get(
        'http://localhost:5001/endpoint/NaN/results',
        { headers: { 'access-token': 'testing-token' } },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 404, 'expected http code 404/Not Found');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should return an error for endpoint owned by some other user', async () => {
      let error: any;
      await axios.get(
        `http://localhost:5001/endpoint/${endpointId}/results`,
        { headers: { 'access-token': 'empty-testing-token' } },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 404, 'expected http code 404/Not Found');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });
  });

  describe('GET /result/:id', () => {
    it('should fail with code 401 when the access-token header is missing', async () => {
      let error: any;
      await axios.get('http://localhost:5001/result/1')
        .catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 401, 'expected http code 401/Unauthorized');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should fail with code 401 when the access-token header is invalid', async () => {
      let error: any;
      await axios.get(
        'http://localhost:5001/result/1',
        { headers: { 'access-token': 'invalid-token' } },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 401, 'expected http code 401/Unauthorized');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should succeed for result that we own', async () => {
      await createTask(endpointId, false).should.be.fulfilled;
      removeTask(endpointId);

      const [rows] = await pool.execute(
        'select id from MonitoringResults where monitoredEndpointId = ?',
        [endpointId],
      ).should.be.fulfilled;
      const result = JSON.parse(JSON.stringify(rows));
      chai.assert.lengthOf(result, 1, 'expected 1 result for endpoint that was checked once');

      const response = await axios.get(
        `http://localhost:5001/result/${result[0].id}`,
        { headers: { 'access-token': 'testing-token' } },
      ).should.be.fulfilled;
      chai.assert.equal(response.status, 200, 'expected http code 200/OK');

      const body = response.data;
      if (!('data' in body)) {
        throw new Error('expected response to contain data');
      }

      await pool.execute(
        'delete from MonitoringResults where monitoredEndpointId = ?',
        [endpointId],
      ).should.be.fulfilled;
    });

    it('should fail for non-existing result', async () => {
      let error: any;
      await axios.get(
        'http://localhost:5001/result/NaN',
        { headers: { 'access-token': 'testing-token' } },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 404, 'expected http code 404/Not Found');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should fail for result owned by some other user', async () => {
      await createTask(endpointId, false).should.be.fulfilled;
      removeTask(endpointId);

      const [rows] = await pool.execute(
        'select id from MonitoringResults where monitoredEndpointId = ?',
        [endpointId],
      ).should.be.fulfilled;
      const result = JSON.parse(JSON.stringify(rows));
      chai.assert.lengthOf(result, 1, 'expected 1 result for endpoint that was checked once');

      let error: any;
      await axios.get(
        `http://localhost:5001/result/${result[0].id}`,
        { headers: { 'access-token': 'empty-testing-token' } },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 404, 'expected http code 404/Not Found');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }

      await pool.execute(
        'delete from MonitoringResults where monitoredEndpointId = ?',
        [endpointId],
      ).should.be.fulfilled;
    });
  });

  describe('POST /endpoint', () => {
    it('should fail with code 401 when the access-token header is missing', async () => {
      let error: any;
      await axios.post(
        'http://localhost:5001/endpoint',
        {
          name: 'New endpoint',
          url: 'http://testing.xyz',
          monitoringInterval: 600,
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 401, 'expected http code 401/Unauthorized');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should fail with code 401 when the access-token header is invalid', async () => {
      let error: any;
      await axios.post(
        'http://localhost:5001/endpoint',
        {
          name: 'New endpoint',
          url: 'http://testing.xyz',
          monitoringInterval: 600,
        },
        {
          headers: {
            'access-token': 'invalid-token',
          },
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 401, 'expected http code 401/Unauthorized');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should contain created endpoint in the response body', async () => {
      const response = await axios.post(
        'http://localhost:5001/endpoint',
        {
          name: 'New endpoint',
          url: 'http://testing.xyz',
          monitoringInterval: 600,
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).should.be.fulfilled;
      chai.assert.equal(response.status, 201, 'expected http code 201/Created');
      const body = response.data;
      if (!('data' in body)) {
        throw new Error('expected response body to contain created endpoint');
      }

      const endpoint = body.data;
      if (!('id' in endpoint)) {
        throw new Error('expected to see id of the endpoint included in the response');
      }
      if (!('name' in endpoint)) {
        throw new Error('expected to see name of the endpoint included in the response');
      }
      if (!('url' in endpoint)) {
        throw new Error('expected to see url of the endpoint included in the response');
      }
      if (!('createdDate' in endpoint)) {
        throw new Error('expected to see createdDate of the endpoint included in the response');
      }
      if (!('lastCheckedDate' in endpoint)) {
        throw new Error('expected to see lastCheckedDate of the endpoint included in the response');
      }
      if (!('monitoringInterval' in endpoint)) {
        throw new Error('expected to see monitoringInterval of the endpoint included in the response');
      }
      if (!('ownerId' in endpoint)) {
        throw new Error('expected to see ownerId of the endpoint included in the response');
      }

      removeTask(body.data.id);

      await pool.execute(
        'delete from MonitoringResults where monitoredEndpointId = ?',
        [body.data.id],
      ).should.be.fulfilled;

      await pool.execute(
        'delete from MonitoredEndpoints where id = ?',
        [body.data.id],
      ).should.be.fulfilled;
    });

    it('should create a database entry for created endpoint', async () => {
      const response = await axios.post(
        'http://localhost:5001/endpoint',
        {
          name: 'New endpoint',
          url: 'http://testing.xyz',
          monitoringInterval: 600,
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).should.be.fulfilled;
      chai.assert.equal(response.status, 201, 'expected http code 201/Created');


      const body = response.data;
      if (!('data' in body)) {
        throw new Error('expected response body to contain created endpoint');
      }
      removeTask(body.data.id);

      const [rows] = await pool.execute(
        'select id from MonitoredEndpoints where id = ?',
        [body.data.id],
      ).should.be.fulfilled;
      const result = JSON.parse(JSON.stringify(rows));
      chai.assert.lengthOf(result, 1);

      await pool.execute(
        'delete from MonitoringResults where monitoredEndpointId = ?',
        [body.data.id],
      ).should.be.fulfilled;

      await pool.execute(
        'delete from MonitoredEndpoints where id = ?',
        [body.data.id],
      ).should.be.fulfilled;
    });

    it('should create a task for created endpoint', async () => {
      const response = await axios.post(
        'http://localhost:5001/endpoint',
        {
          name: 'New endpoint',
          url: 'http://testing.xyz',
          monitoringInterval: 600,
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).should.be.fulfilled;
      chai.assert.equal(response.status, 201, 'expected http code 201/Created');

      const body = response.data;
      if (!('data' in body)) {
        throw new Error('expected response body to contain created endpoint');
      }

      const tasks = getTasks();
      if (!tasks.has(body.data.id)) {
        throw new Error('expected api to create a task for created endpoint');
      }

      removeTask(body.data.id);

      await pool.execute(
        'delete from MonitoringResults where monitoredEndpointId = ?',
        [body.data.id],
      ).should.be.fulfilled;

      await pool.execute(
        'delete from MonitoredEndpoints where id = ?',
        [body.data.id],
      ).should.be.fulfilled;
    });

    it('should fail when the name parameter is missing', async () => {
      let error: any;
      await axios.post(
        'http://localhost:5001/endpoint',
        {
          url: 'http://testing.xyz',
          monitoringInterval: 600,
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 400, 'expected http code 400/Bad Request');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should fail when the url parameter is missing', async () => {
      let error: any;
      await axios.post(
        'http://localhost:5001/endpoint',
        {
          name: 'New endpoint',
          monitoringInterval: 600,
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 400, 'expected http code 400/Bad Request');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should fail when the monitoringInterval parameter is missing', async () => {
      let error: any;
      await axios.post(
        'http://localhost:5001/endpoint',
        {
          name: 'New endpoint',
          url: 'http://testing.xyz',
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 400, 'expected http code 400/Bad Request');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should fail when the name parameter is invalid', async () => {
      let error: any;
      await axios.post(
        'http://localhost:5001/endpoint',
        {
          name: 'Ne',
          url: 'http://testing.xyz',
          monitoringInterval: 600,
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 400, 'expected http code 400/Bad Request');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should fail when the url parameter is invalid', async () => {
      let error: any;
      await axios.post(
        'http://localhost:5001/endpoint',
        {
          name: 'Ne',
          url: 'testing.xyz',
          monitoringInterval: 600,
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 400, 'expected http code 400/Bad Request');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should fail when the monitoringInterval parameter is invalid', async () => {
      let error: any;
      await axios.post(
        'http://localhost:5001/endpoint',
        {
          name: 'New endpoint',
          url: 'testing.xyz',
          monitoringInterval: 6,
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 400, 'expected http code 400/Bad Request');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });
  });

  describe('PATCH /endpoint/:id', () => {
    it('should fail with code 401 when the access-token header is missing', async () => {
      let error: any;
      await axios.patch(
        `http://localhost:5001/endpoint/${endpointId}`,
        {
          name: 'New name',
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 401, 'expected http code 401/Unauthorized');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should fail with code 401 when the access-token header is invalid', async () => {
      let error: any;
      await axios.patch(
        `http://localhost:5001/endpoint/${endpointId}`,
        {
          name: 'New name',
        },
        {
          headers: {
            'access-token': 'invalid-token',
          },
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 401, 'expected http code 401/Unauthorized');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should succeed for endpoint that we own', async () => {
      await createTask(endpointId);
      const newName = 'New name';
      const response = await axios.patch(
        `http://localhost:5001/endpoint/${endpointId}`,
        {
          name: newName,
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      );
      chai.assert.equal(response.status, 200, 'expected http code 201/OK');

      const body = response.data;
      if (!('data' in body)) {
        throw new Error('expected response body to contain updated endpoint');
      }

      const [rows] = await pool.execute(
        'select name from MonitoredEndpoints where id = ?',
        [endpointId],
      ).should.be.fulfilled;
      const result = JSON.parse(JSON.stringify(rows));
      chai.assert.lengthOf(result, 1);
      chai.assert.equal(result[0].name, newName);

      await pool.execute(
        'update MonitoredEndpoints set name = \'testing\' where id = ?',
        [endpointId],
      ).should.be.fulfilled;

      removeTask(endpointId);
      await pool.execute(
        'delete from MonitoringResults where monitoredEndpointId = ?',
        [endpointId],
      ).should.be.fulfilled;
    });

    it('should succeed when no parameters are provided', async () => {
      await createTask(endpointId);
      const response = await axios.patch(
        `http://localhost:5001/endpoint/${endpointId}`,
        {},
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).should.be.fulfilled;
      chai.assert.equal(response.status, 200, 'expected http code 201/OK');

      const body = response.data;
      if (!('data' in body)) {
        throw new Error('expected response body to contain updated endpoint');
      }

      removeTask(endpointId);
      await pool.execute(
        'delete from MonitoringResults where monitoredEndpointId = ?',
        [endpointId],
      ).should.be.fulfilled;
    });

    it('should preserve a task associated with the endpoint', async () => {
      await createTask(endpointId);

      const response = await axios.patch(
        `http://localhost:5001/endpoint/${endpointId}`,
        {},
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).should.be.fulfilled;
      chai.assert.equal(response.status, 200, 'expected http code 201/OK');

      const body = response.data;
      if (!('data' in body)) {
        throw new Error('expected response body to contain updated endpoint');
      }

      const tasks = getTasks();
      if (!tasks.has(endpointId)) {
        throw new Error('expected api to preserve a task associated with the endpoint');
      }

      removeTask(endpointId);
      await pool.execute(
        'delete from MonitoringResults where monitoredEndpointId = ?',
        [endpointId],
      ).should.be.fulfilled;
    });

    it('should fail for non-existing endpoint', async () => {
      let error: any;
      await axios.patch(
        'http://localhost:5001/endpoint/NaN',
        {
          name: 'New name',
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 404, 'expected http code 404/Not Found');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to an error message');
      }
    });

    it('should fail for endpoint owned by another user', async () => {
      let error: any;
      await axios.patch(
        `http://localhost:5001/endpoint/${endpointId}`,
        {
          name: 'New name',
        },
        {
          headers: {
            'access-token': 'empty-testing-token',
          },
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 404, 'expected http code 404/Not Found');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to an error message');
      }
    });

    it('should fail when the name parameter is invalid', async () => {
      let error: any;
      await axios.patch(
        `http://localhost:5001/endpoint/${endpointId}`,
        {
          name: 'Ne',
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 400, 'expected http code 404/Bad Request');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to an error message');
      }
    });

    it('should fail when the url parameter is invalid', async () => {
      let error: any;
      await axios.patch(
        `http://localhost:5001/endpoint/${endpointId}`,
        {
          url: 'testing.xyz',
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 400, 'expected http code 400/Bad Request');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to an error message');
      }
    });

    it('should fail when the monitoringInterval parameter is invalid', async () => {
      let error: any;
      await axios.patch(
        `http://localhost:5001/endpoint/${endpointId}`,
        {
          monitoringInterval: 6,
        },
        {
          headers: {
            'access-token': 'testing-token',
          },
        },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 400, 'expected http code 400/Bad Request');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to an error message');
      }
    });
  });

  describe('DELETE /endpoint/:id', () => {
    it('should fail with code 401 when the access-token header is missing', async () => {
      let error: any;
      await axios.delete(`http://localhost:5001/endpoint/${endpointId}`)
        .catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 401, 'expected http code 401/Unauthorized');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should fail with code 401 when the access-token header is invalid', async () => {
      let error: any;
      await axios.delete(
        `http://localhost:5001/endpoint/${endpointId}`,
        { headers: { 'access-token': 'invalid-token' } },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 401, 'expected http code 401/Unauthorized');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should succeed for endpoint that we own', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'Another endpoint',
        'http://another.testing.xyz',
        new Date(),
        null,
        3600,
        userId,
      );
      await endpoint.save().should.be.fulfilled;

      if (endpoint.id === null) {
        throw new Error('failed to pull id of created endpoint from database');
      }
      await createTask(endpoint.id).should.be.fulfilled;

      const response = await axios.delete(
        `http://localhost:5001/endpoint/${endpoint.id}`,
        { headers: { 'access-token': 'testing-token' } },
      ).should.be.fulfilled;

      chai.assert.equal(response.status, 200, 'expected http code 200/OK');

      const body = response.data;
      if (!('data' in body)) {
        throw new Error('expected response to contain deleted endpoint');
      }

      await pool.execute(
        'delete from MonitoringResults where monitoredEndpointId = ?',
        [endpoint.id],
      );

      await pool.execute(
        'delete from MonitoredEndpoints where id = ?',
        [endpoint.id],
      );
    });

    it('should fail for non-existing endpoint', async () => {
      let error: any;
      await axios.delete(
        'http://localhost:5001/endpoint/NaN',
        { headers: { 'access-token': 'testing-token' } },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 404, 'expected http code 404/Not Found');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should fail for endpoint owned by another user', async () => {
      let error: any;
      await axios.delete(
        `http://localhost:5001/endpoint/${endpointId}`,
        { headers: { 'access-token': 'empty-testing-token' } },
      ).catch((e) => { error = e; });
      chai.assert.equal(error.response?.status, 404, 'expected http code 404/Not Found');

      const body = error.response?.data;
      if (!('error' in body)) {
        throw new Error('expected response body to contain an error message');
      }
    });

    it('should remove the task associated with the endpoint', async () => {
      const endpoint = new MonitoredEndpoint(
        null,
        'Another endpoint',
        'http://another.testing.xyz',
        new Date(),
        null,
        3600,
        userId,
      );
      await endpoint.save().should.be.fulfilled;

      if (endpoint.id === null) {
        throw new Error('failed to pull id of created endpoint from database');
      }
      await createTask(endpoint.id).should.be.fulfilled;

      const response = await axios.delete(
        `http://localhost:5001/endpoint/${endpoint.id}`,
        { headers: { 'access-token': 'testing-token' } },
      ).should.be.fulfilled;

      const tasks = getTasks();
      if (tasks.has(endpoint.id)) {
        throw new Error('expected api to remove task associated with the endpoint');
      }

      chai.assert.equal(response.status, 200, 'expected http code 200/OK');

      const body = response.data;
      if (!('data' in body)) {
        throw new Error('expected response to contain deleted endpoint');
      }

      await pool.execute(
        'delete from MonitoringResults where monitoredEndpointId = ?',
        [endpoint.id],
      );

      await pool.execute(
        'delete from MonitoredEndpoints where id = ?',
        [endpoint.id],
      );
    });
  });
});
