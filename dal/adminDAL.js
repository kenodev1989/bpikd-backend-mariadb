import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import pool from "../db/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const queryPath = path.join(__dirname, "../db/queries/adminQueries.sql");
const queries = fs.readFileSync(queryPath, "utf-8").split(";");

export async function emailExists(email) {
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query(
      "SELECT COUNT(*) as count FROM users WHERE email = ?;",
      [email]
    );
    return result[0].count > 0;
  } finally {
    if (conn) conn.release();
  }
}

// Function to execute a specific query by index
export async function executeQuery(queryIndex, params) {
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query(queries[queryIndex], params);
    return result;
  } finally {
    if (conn) conn.release();
  }
}

export async function getUserByUsername(username) {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT * FROM users WHERE username = ?", [
      username,
    ]); // Direct query for clarity
    return rows[0]; // assuming the query returns at least one row
  } catch (err) {
    console.error("Database error in getUserByUsername:", err);
    throw err; // It's important to rethrow the error so the calling function knows something went wrong
  } finally {
    if (conn) await conn.release(); // Ensure the connection is always released
  }
}

export async function createUser(details) {
  let conn;
  try {
    // First check if the email already exists
    if (await emailExists(details.email)) {
      throw new Error("Email already exists");
    }
    conn = await pool.getConnection();
    const result = await conn.query(
      "INSERT INTO users (firstname, lastname, nickname, username, email, password, role, verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        details.firstname,
        details.lastname,
        details.nickname,
        details.username,
        details.email,
        details.password,
        details.role,
        details.verified,
        details.created_at,
        details.updated_at,
      ]
    );
    return { id: result.insertId, ...details };
  } finally {
    if (conn) conn.release();
  }
}

export async function deleteUser(id) {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.query("DELETE FROM users WHERE id = ?;", [id]); // Using parameterized queries for safety
  } finally {
    if (conn) await conn.release(); // Ensure the connection is always released
  }
}

export async function getUserByIdFromDB(id) {
  let conn;
  try {
    conn = await pool.getConnection();
    const sql =
      "SELECT id, firstname, lastname, username, email, role, verified, created_at, updated_at FROM users WHERE id = ?;";
    const result = await conn.query(sql, [id]);
    return result[0]; // Assuming IDs are unique and only one record is returned
  } catch (error) {
    console.error("Error in getUserByIdFromDB:", error);
    throw error;
  } finally {
    if (conn) conn.release();
  }
}

export async function deleteMultipleUsers(userIds) {
  let conn;
  try {
    conn = await pool.getConnection();
    const query = "DELETE FROM users WHERE id IN (?);"; // SQL query for multiple deletions
    const formattedIds = userIds.join(","); // Format array for SQL IN clause
    await conn.query(query, [formattedIds]);
  } finally {
    if (conn) await conn.release();
  }
}

export async function getAllUsers() {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(queries[4]); // SELECT * FROM users WHERE role IN...
    return rows;
  } finally {
    if (conn) await conn.end();
  }
}

export async function updateUserById(userId, updates) {
  let conn;
  try {
    conn = await pool.getConnection();
    const query =
      "UPDATE users SET firstname=?, lastname=?, email=?, password=?, role=? WHERE id=?";
    const params = [
      updates.firstname,
      updates.lastname,
      updates.email,
      updates.password,
      updates.role,
      userId,
    ];
    await conn.query(query, params);
    return await getUserById(userId); // Assuming you have a function to fetch updated user data
  } finally {
    if (conn) conn.release();
  }
}
