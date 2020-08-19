import mysql from 'mysql2/promise';

let db: void | mysql.Connection;

export async function initDbConnection(): Promise<void> {
  db = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
  }).catch(async (e) => {
    console.log(`db connection failed, retrying in 5 seconds ...\n${e}`);
    await new Promise((resolve) => { setTimeout(resolve, 5000); });
    await initDbConnection();
  });
}

export function getDbConnection(): mysql.Connection {
  return <mysql.Connection>db;
}
