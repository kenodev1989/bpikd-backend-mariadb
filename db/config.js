import mariadb from 'mariadb';
import dotenv from 'dotenv';
dotenv.config();

const pool = mariadb.createPool({
  host: process.env.NODE_DB_HOST,
  user: process.env.NODE_DB_USER,
  port: process.env.NODE_DB_PORT,
  password: process.env.NODE_DB_PASS,
  database: process.env.NODE_DB_NAME,
  connectionLimit: 50,
  idleTimeout: 30000, // milliseconds
  connectTimeout: 30000, // milliseconds
});

export default pool;
