import * as dotenv from 'dotenv-safe';
import * as restify from 'restify';
import { initDbConnection } from './utils/database';

async function main() {
  dotenv.config();

  const server = restify.createServer({
    name: 'urlmon api',
  });

  console.log('Connecting to database ...');
  await initDbConnection();
  console.log('Successfully connected to database');

  server.listen(5000, () => {
    console.log(`${server.name} listening at ${server.url}`);
  });
}

main();
