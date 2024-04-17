import pool from "./config.js";

export const createTableUsers = async () => {
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

/* CREATE TABLE footer_companies (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company VARCHAR(255),
    description TEXT,
    url VARCHAR(255),
    src VARCHAR(255),
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
); */

const mysql = require("mysql2/promise");

async function initializeDatabase() {
  const connection = await mysql.createConnection({
    host: "your_host",
    user: "your_username",
    password: "your_password",
    database: "your_database",
  });

  try {
    // Create the 'persons' table
    await connection.execute(`
            CREATE TABLE IF NOT EXISTS persons (
                id INT AUTO_INCREMENT PRIMARY KEY,
                firstName VARCHAR(255),
                lastName VARCHAR(255),
                aboutPerson TEXT,
                featured VARCHAR(255),
                createdBy VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            );
        `);

    // Create the 'works' table
    await connection.execute(`
            CREATE TABLE IF NOT EXISTS works (
                id INT AUTO_INCREMENT PRIMARY KEY,
                person_id INT,
                title VARCHAR(255),
                content TEXT,
                publishTime VARCHAR(255),
                isPublished BOOLEAN,
                scheduledPublishTime DATETIME,
                externalSource VARCHAR(255),
                createdBy VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (person_id) REFERENCES persons(id) ON DELETE CASCADE
            );
        `);

    // Create the 'media' table
    await connection.execute(`
            CREATE TABLE IF NOT EXISTS media (
                id INT AUTO_INCREMENT PRIMARY KEY,
                work_id INT,
                url VARCHAR(255),
                name VARCHAR(255),
                fileType VARCHAR(255),
                FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
            );
        `);

    console.log("All tables created or already exist");
  } catch (error) {
    console.error("Error creating tables:", error);
  } finally {
    await connection.end();
  }
}

/* initializeDatabase(); */

/* CREATE TABLE IF NOT EXISTS works (
    id INT AUTO_INCREMENT PRIMARY KEY,
    person_id INT,
    title VARCHAR(255),
    content TEXT,
    publishTime VARCHAR(255),
    isPublished BOOLEAN,
    scheduledPublishTime DATETIME,
    externalSource VARCHAR(255),
    createdBy VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB; -- specifying engine might be important

-- Ensure the media table is defined correctly
CREATE TABLE IF NOT EXISTS media (
    id INT AUTO_INCREMENT PRIMARY KEY,
    work_id INT,
    url VARCHAR(255),
    name VARCHAR(255),
    fileType VARCHAR(255),
    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE
) ENGINE=InnoDB;  -- specifying engine might be important */
