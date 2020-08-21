import mysql from 'mysql2/promise';

let db: mysql.Pool;

export async function initDbConnection(): Promise<void> {
  db = mysql.createPool({
    connectionLimit: 10,
    host: process.env.MYSQL_HOST,
    database: process.env.MYSQL_DATABASE,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
  });
  await db.getConnection();
}

export function getDbPool(): mysql.Pool {
  return db;
}
