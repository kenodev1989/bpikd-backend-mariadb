import express from 'express';
import pool from '../db/config.js';

const router = express.Router();

router.post('/', async (req, res) => {
  const { isPlaying, active, text } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();
    const results = await conn.query('SELECT id FROM text_settings LIMIT 1');
    let result;
    if (results.length === 0) {
      // No existing settings, create new
      result = await conn.query(
        'INSERT INTO text_settings (isPlaying, active, text) VALUES (?, ?, ?)',
        [isPlaying, active, text]
      );
      res.send({
        success: true,
        message: 'New settings created successfully',
        id: result.insertId.toString(),
      });
    } else {
      // Update existing settings
      result = await conn.query(
        'UPDATE text_settings SET isPlaying = ?, active = ?, text = ? WHERE id = ?',
        [isPlaying, active, text, results[0].id]
      );
      if (result.affectedRows === 0) {
        res
          .status(404)
          .send({ success: false, message: 'Record not found for update' });
      } else {
        res.send({ success: true, message: 'Settings updated successfully' });
      }
    }
    conn.release();
  } catch (err) {
    console.error(err);
    conn.release();
    res.status(500).send('Database error');
  }
});

// GET settings data
router.get('/', async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const results = await conn.query('SELECT * FROM text_settings LIMIT 1'); // Fetch the single row
    conn.release();
    if (results.length > 0) {
      res.json(results[0]);
    } else {
      res.status(404).json({ message: 'Settings not found' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Database error' });
  }
});

export default router;
