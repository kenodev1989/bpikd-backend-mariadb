import mariadb from 'mariadb';
import dotenv from 'dotenv';
dotenv.config();

const pool = mariadb.createPool({
  /* host: process.env.NODE_DB_HOST,
  user: process.env.NODE_DB_USER,
  port: process.env.NODE_DB_PORT,
  password: process.env.NODE_DB_PASS,
  database: process.env.NODE_DB_NAME,
  connectTimeout: 20000, */

  host: process.env.NODE_DB_HOST,
  user: process.env.NODE_DB_USER,
  port: process.env.NODE_DB_PORT,
  password: process.env.NODE_DB_PASS,
  database: process.env.NODE_DB_NAME,
  connectionLimit: 50,
  acquireTimeout: 30000,
  connectTimeout: 30000,
});

export default pool;
