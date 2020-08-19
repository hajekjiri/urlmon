import mysql from 'mysql2/promise';

let db: void | mysql.Connection;

export async function initDbConnection(_host: undefined | string): Promise<boolean> {
  try {
    db = await mysql.createConnection({
      host: _host,
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
    });
  } catch (e) {
    console.log(e.message);
    return false;
  }
  return true;
}

export function getDbConnection(): mysql.Connection {
  return <mysql.Connection>db;
}
