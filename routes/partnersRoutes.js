import express from 'express';
import multer from 'multer';
import path from 'path';
import pool from '../db/config.js'; // Ensure your database configuration is correctly imported
import { baseRoute } from '../helpers/config.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: './public/uploads/partners',
  filename: function (req, file, cb) {
    const match = file.fieldname.match(/partnersImages-(\d+)/);
    const index = match ? match[1] : 'default';
    const fileExtension = path.extname(file.originalname);
    const filename = `partnersImages-${index}${fileExtension}`;
    cb(null, filename);
  },
});

const fields = [];
for (let i = 0; i < 21; i++) {
  fields.push({ name: `partnersImages-${i}`, maxCount: 1 });
}

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    if (
      filetypes.test(path.extname(file.originalname).toLowerCase()) &&
      filetypes.test(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed! (JPEG, JPG, PNG, GIF)'));
    }
  },
}).fields(fields);

router.post('/', upload, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const partnersData = JSON.parse(req.body.partnersData || '[]'); // Parse the JSON input safely

    const results = await Promise.all(
      partnersData.map(async (partnerData, index) => {
        const file = req.files[`partnersImages-${index}`]
          ? req.files[`partnersImages-${index}`][0]
          : null;
        let filePath = partnerData.imagePath;
        const url = partnerData.url || ''; // Default to empty string if no URL provided

        if (file) {
          // If a new file is uploaded, update the file path
          filePath = `${req.protocol}://${req.get(
            'host'
          )}/${baseRoute}/uploads/partners/${file.filename}`;
        } else if (partnerData.id) {
          // If no new file and id exists, attempt to reuse the existing file path
          const [existing] = await conn.query(
            'SELECT imagePath FROM partners WHERE id = ?',
            [partnerData.id]
          );
          if (existing.length > 0) {
            filePath = existing[0].imagePath;
          }
        }

        if (partnerData.id) {
          // Update existing partner info
          await conn.query(
            'UPDATE partners SET imagePath = ?, url = ?, createdAt = NOW() WHERE id = ?',
            [filePath, url, partnerData.id]
          );
        } else {
          // Insert new partner info
          const result = await conn.query(
            'INSERT INTO partners (imagePath, url, createdAt) VALUES (?, ?, NOW())',
            [filePath, url]
          );
          partnerData.id = result.insertId.toString(); // Update partnerData with new ID
        }
        return { ...partnerData, imagePath: filePath, url }; // Return the updated partner info
      })
    );

    res.json({
      message: 'Partners updated successfully',
      data: results,
    });
  } catch (error) {
    console.error('Error updating partners:', error);
    res.status(500).send('Server error: ' + error.message);
  } finally {
    if (conn) {
      conn.release(); // Always release connection
    }
  }
});

router.get('/', async (req, res) => {
  let conn;
  try {
    // Establish a connection from the pool
    conn = await pool.getConnection();
    const query = 'SELECT * FROM partners';
    const results = await conn.query(query);

    if (results.length === 0) {
      // Properly handle the case where no records are found
      return res.status(404).json({ message: 'No partners found' });
    }

    // Return all the fetched records properly formatted as JSON
    res.json({
      message: 'Successfully retrieved partners data',
      results,
    });
  } catch (error) {
    // Log and return any errors encountered during the operation
    console.error('Error fetching partners data:', error);
    res.status(500).json({ message: 'Server error', error: error.toString() });
  } finally {
    // Always release the connection back to the pool
    if (conn) {
      conn.release();
    }
  }
});

// DELETE route to delete a partner by ID
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query('DELETE FROM partners WHERE id = ?', [id]);
    if (result.affectedRows) {
      res.json({ message: 'Partner deleted successfully' });
    } else {
      res.status(404).send('Partner not found');
    }
  } catch (error) {
    console.error('Error deleting partner:', error);
    res.status(500).send('Server error');
  } finally {
    if (conn) {
      conn.release(); // Always release connection
    }
  }
});

export default router;
