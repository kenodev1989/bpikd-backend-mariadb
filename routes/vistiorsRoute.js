import express from 'express';
const router = express.Router();
import useragent from 'express-useragent';
import geoip from 'geoip-lite';
import pool from '../db/config.js';

// Get all visitors

router.get('/all', async (req, res) => {
  let conn;

  try {
    conn = await pool.getConnection();
    const query = 'SELECT * FROM visitors ORDER BY last_visit DESC';
    const results = await conn.query(query);

    // Use a custom replacer to handle BigInt serialization
    const jsonString = JSON.stringify(
      results,
      (key, value) => (typeof value === 'bigint' ? value.toString() : value) // convert bigint to string
    );

    res.setHeader('Content-Type', 'application/json');
    res.send(jsonString);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) conn.end(); // release the connection back to the pool
  }
});

router.get('/total', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const updateQuery =
      'UPDATE visit_count SET total_visits = total_visits + 1 WHERE id = 1';
    await conn.query(updateQuery);

    const selectQuery = 'SELECT total_visits FROM visit_count WHERE id = 1';
    const results = await conn.query(selectQuery);

    // Directly modify the result for serialization, if necessary
    results.forEach((result) => {
      if (typeof result.total_visits === 'bigint') {
        result.total_visits = result.total_visits.toString(); // Convert bigint to string
      }
    });

    res.json({
      success: true,
      totalVisits: results[0].total_visits,
    });
  } catch (error) {
    console.error('Failed to increment visit count:', error);
    res.status(500).send('Database error');
  } finally {
    if (conn) conn.release(); // Ensure the connection is released back to the pool
  }
});

// Route to handle new visits
router.get('/', async (req, res) => {
  const ip = req.clientIp; // Make sure you have middleware to correctly fetch the IP
  const userAgent = req.headers['user-agent']; // Directly getting user-agent

  let conn;
  try {
    conn = conn = await pool.getConnection();

    const query = `INSERT INTO visitors (ip_address, system_info) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE count = count + 1, last_visit = CURRENT_TIMESTAMP`;

    const result = await conn.query(query, [ip, userAgent]);

    const finalResult = result.insertId.toString();

    res.json({
      success: true,
      message: 'Visitor counted',
      ip,
      userAgent,
      finalResult,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  }
});

router.delete('/:id', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { id } = req.params; // Get the ID from the request parameters
    const deleteQuery = 'DELETE FROM visitors WHERE id = ?';
    await conn.query(deleteQuery, [id]);

    res.json({
      success: true,
      message: `Visitor with ID ${id} deleted successfully.`,
    });
  } catch (error) {
    console.error('Failed to delete visitor:', error);
    res.status(500).send('Database error');
  } finally {
    if (conn) conn.release(); // Ensure the connection is released back to the pool
  }
});

export default router;
