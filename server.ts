import dotenv = require('dotenv-safe');
import restify = require('restify');
import mysql = require('mysql2/promise');

async function getDbConnection(): Promise<mysql.Connection> {
  return mysql.createConnection({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
  }).catch(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 5000); });
    return getDbConnection();
  });
}

async function main() {
  dotenv.config();

  const server = restify.createServer({
    name: 'urlmon api',
  });

  console.log('Connecting to database ...');
  const connection = await getDbConnection().then(() => {
    console.log('Successfully connected to database');
  });

  server.listen(5000, () => {
    console.log(`${server.name} listening at ${server.url}`);
  });
}

main();
