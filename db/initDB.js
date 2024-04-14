import pool from "./config.js";

export const createTable = async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    const sql = `
        CREATE TABLE users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            firstname VARCHAR(255),
            lastname VARCHAR(255),
            nickname VARCHAR(255),
            username VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            verified BOOLEAN DEFAULT FALSE,
            password VARCHAR(255) NOT NULL,
            role ENUM('admin', 'editor', 'user') NOT NULL DEFAULT 'user',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
        `;
    await conn.query(sql);
    console.log("Table created successfully!");
  } catch (err) {
    console.error("Failed to create table:", err);
  } finally {
    if (conn) await conn.end();
  }
};
