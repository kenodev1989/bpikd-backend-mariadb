import express from 'express';
import pool from '../db/config.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { headerColor, footerColor, headerTextColor, footerTextColor } =
    req.body;

  let conn;
  try {
    const conn = await pool.getConnection();
    await conn.query(
      `UPDATE theme_settings SET headerColor = ?, footerColor = ?, headerTextColor = ?, footerTextColor = ? WHERE id = 1`,
      [headerColor, footerColor, headerTextColor, footerTextColor]
    );
    conn.release();
    res.send({ message: 'Theme updated successfully' });
  } catch (error) {
    conn.release();
    res.status(500).send('Database error');
  }
});

router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    // Since there's only one row, we can directly fetch it without specifying an ID
    const results = await conn.query(
      'SELECT * FROM theme_settings WHERE id = 1'
    );
    conn.release();
    if (results.length > 0) {
      res.json(results[0]); // Send the first row of results
    } else {
      res.status(404).json({ message: 'Theme settings not found' });
    }
  } catch (error) {
    console.error('Failed to fetch theme settings:', error);
    res.status(500).json({ message: 'Database error' });
  }
});

export default router;
