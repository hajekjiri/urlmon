import mysql from 'mysql2/promise';

let db: void | mysql.Connection;

export async function initDbConnection(): Promise<void> {
  db = await mysql.createConnection({
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
  }).catch(async () => {
    console.log('db connection failed, retrying in 5 seconds ...');
    await new Promise((resolve) => { setTimeout(resolve, 5000); });
    await initDbConnection();
  });
}

export function getDbConnection(): mysql.Connection {
  return <mysql.Connection>db;
}
