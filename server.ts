import dotenv from 'dotenv-safe';
import restify from 'restify';
import { initDbConnection } from './utils/database';
import { initializeTasks } from './utils/monitoring';
import {
  getEndpointsHandler,
  getEndpointResultsHandler,
  postEndpointHandler,
  deleteEndpointHandler,
} from './utils/handlers';

async function main() {
  dotenv.config();

  const server = restify.createServer({
    name: 'urlmon api',
  });

  server.use(restify.plugins.bodyParser());

  console.log('Connecting to database ...');

  /* eslint-disable no-await-in-loop */
  while (!await initDbConnection(process.env.MYSQL_HOST)) {
    console.log('db connection failed, retrying in 5 seconds ...');
    await new Promise((resolve) => { setTimeout(resolve, 5000); });
  }
  /* eslint-enable no-await-in-loop */

  console.log('Successfully connected to database');

  server.get('/endpoints', getEndpointsHandler);
  server.get('/endpoint/:id/results', getEndpointResultsHandler);
  server.post('/endpoint', postEndpointHandler);
  server.del('/endpoint/:id', deleteEndpointHandler);

  server.listen(5000, () => {
    console.log(`${server.name} listening at ${server.url}`);
  });

  initializeTasks();
}

main();
