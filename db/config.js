import mariadb from "mariadb";

// Database configuration details from environment variables or default values
const pool = mariadb.createPool({
  host: process.env.DB_HOST || "keni.ba",
  user: process.env.DB_USER || "keniba_bpikd",
  port: "3306",
  password: process.env.DB_PASS || "bpikd123bpikd123",
  database: process.env.DB_NAME || "keniba_bpikd",
});

export default pool;
