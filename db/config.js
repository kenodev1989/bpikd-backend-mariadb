import mariadb from "mariadb";

// Database configuration details from environment variables or default values
const pool = mariadb.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "bpikd_backend",
  connectionLimit: 5,
});

export default pool;
