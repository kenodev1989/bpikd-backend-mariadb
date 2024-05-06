import express from 'express';
const router = express.Router();
import useragent from 'express-useragent';
import pool from '../db/config.js';
import UAParser from 'ua-parser-js';

// Get all visitors

/* router.get("/", async (req, res) => {
  const ip = req.clientIp; // Make sure you have middleware to correctly fetch the IP
  const userAgent = req.headers["user-agent"]; // Directly getting user-agent

  let conn;
  try {
    conn = conn = await pool.getConnection();

    const query = `INSERT INTO visitors (ip_address, system_info) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE count = count + 1, last_visit = CURRENT_TIMESTAMP`;

    const result = await conn.query(query, [ip, userAgent]);

    const finalResult = result.insertId.toString();

    res.json({
      success: true,
      message: "Visitor counted",
      ip,
      userAgent,
      finalResult,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  }
});
 */

router.use(useragent.express());

router.post('/', async (req, res) => {
  const ip = req.clientIp;
  const userAgent = req.headers['user-agent'];

  // Check if device info is provided in the query parameters
  const deviceInfo = req.body.params; // Adjust this based on how you send device info from frontend

  // Use ua-parser-js to parse the user-agent string
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const { browser, os, platform } = result;
  const isMobile = result.device.type === 'mobile';
  const isTablet = result.device.type === 'tablet';
  const isDesktop = !isMobile && !isTablet;
  const device = deviceInfo || 'Unknown'; // Use deviceInfo if provided, otherwise get device model from user-agent
  const platformType = result.platform ? result.platform.type : 'Unknown';

  console.log(deviceInfo);

  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      INSERT INTO visitors (ip_address, system_info, browser_name, os, platform, is_mobile, is_tablet, is_desktop, device)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE count = count + 1, last_visit = CURRENT_TIMESTAMP`;

    await conn.query(query, [
      ip,
      userAgent,
      browser.name,
      os.name,
      platformType,
      isMobile,
      isTablet,
      isDesktop,
      device,
    ]);

    // Fetch the last inserted visitor
    const selectQuery =
      'SELECT * FROM visitors WHERE ip_address = ? ORDER BY last_visit DESC LIMIT 1';
    const [visitor] = await conn.query(selectQuery, [ip]);

    // Serialize the result for response
    const serializedResult = {
      ...visitor,
      count: visitor.count.toString(),
      last_visit: visitor.last_visit.toString(),
    };

    res.json(serializedResult);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) conn.release();
  }
});

router.get('/all', async (req, res) => {
  let conn;

  try {
    conn = await pool.getConnection();
    const query = 'SELECT * FROM visitors ORDER BY last_visit DESC';
    const results = await conn.query(query);

    // Custom replacer function to handle BigInt serialization
    const replacer = (key, value) =>
      typeof value === 'bigint' ? value.toString() : value; // Convert BigInt to string

    // Serialize with the custom replacer
    const jsonString = JSON.stringify(results, replacer);

    res.setHeader('Content-Type', 'application/json');
    res.send(jsonString);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) conn.release(); // release the connection back to the pool
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
