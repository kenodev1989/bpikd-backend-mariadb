import express from 'express';

import { verifyToken } from '../middleware/auth.js';

import {
  addOrUpdatePersonAndWork,
  deleteMediaById,
  deleteMultiplePersons,
  deletePerson,
  deleteWorkById,
  getAllPersonsWithData,
  getPersonBasics,
  getPersonBasicsById,
  getPersonWithWorksAndMedia,
  getPersonWithWorksAndMediaById,
  getPersonWithWorksById,
  getWorkWithMediaById,
  searchPersonsByPartialName,
  updatePersonBasicById,
  updateWorkById,
  uploadMedia,
  uploadPersonBasicFeature,
} from '../controllers/personController.js';
import pool from '../db/config.js';
import { slugify } from '../utils/slugify.js';

const router = express.Router();

const preprocessRequestBody = (req, res, next) => {
  if (req.is('multipart/form-data')) {
    let rawData = '';
    req.on('data', (chunk) => {
      rawData += chunk.toString(); // buffer to string
    });
    req.on('end', () => {
      try {
        // Find a way to extract and parse only the JSON part
        // For example, you might know that the JSON part always comes as a field named 'data'
        const dataStartPosition =
          rawData.indexOf('name="data"') + 'name="data"'.length;
        const dataEndPosition = rawData.indexOf('------', dataStartPosition); // Assuming boundary starts with '------'
        const jsonData = rawData
          .substring(dataStartPosition, dataEndPosition)
          .trim();

        // Now parse the JSON data
        if (jsonData) {
          req.parsedData = JSON.parse(jsonData);
        }
        next();
      } catch (error) {
        console.error('Error parsing JSON data:', error);
        res.status(400).json({ message: 'Invalid JSON data provided.' });
      }
    });
  } else {
    next();
  }
};

async function fetchTitle(req, res, next) {
  const workId = req.params.workId;
  try {
    const [rows, fields] = await pool.query(
      'SELECT title FROM works WHERE id = ?',
      [workId]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Work not found' });
    }
    req.workTitle = slugify(rows.title);
    next();
  } catch (error) {
    console.error('Failed to fetch title:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  }
}

router.get('/basic', getPersonBasics);

router.get('/list', getAllPersonsWithData);
// Route to delete multiple persons

router.get('/data', getPersonWithWorksAndMedia);

router.get('/find', searchPersonsByPartialName);
router.post('/delete-multiply', verifyToken, deleteMultiplePersons);

router.get('/:personId', getPersonWithWorksById);
router.put(
  '/:personId',
  uploadPersonBasicFeature.single('featuredImage'),
  updatePersonBasicById
);
router
  .route('/:title')
  .post(verifyToken, uploadMedia, addOrUpdatePersonAndWork);

router.delete('/media/:mediaId', deleteMediaById);

// POST route to handle media uploads for a specific work
router.post(
  '/work/:workId/media',
  fetchTitle,
  uploadMedia,
  async (req, res) => {
    const workId = req.params.workId;
    let media = { images: [], videos: [], audios: [], documents: [] };

    const title = req.workTitle;

    let conn;
    try {
      conn = await pool.getConnection(); // Ensure pool is defined and imported properly

      const promises = [];
      ['images', 'videos', 'audios', 'documents'].forEach((type) => {
        if (req.files && req.files[type]) {
          req.files[type].forEach((file) => {
            const url = `${req.protocol}://${req.get('host')}/${slugify(
              title
            )}/${type}/${slugify(file.originalname)}`;
            const mediaItem = {
              url: url,
              name: file.originalname,
              fileType: file.mimetype,
              type: type,
            };

            media[type].push(mediaItem);
            promises.push(
              conn
                .query(
                  'INSERT INTO media (work_id, url, name, fileType, type) VALUES (?, ?, ?, ?, ?)',
                  [workId, url, file.originalname, file.mimetype, type]
                )
                .then((insertResult) => {
                  mediaItem.mediaId = insertResult.insertId.toString();
                })
            );
          });
        }
      });

      await Promise.all(promises);
      res.json({
        message: 'Media files uploaded successfully',
        media: media,
      });
    } catch (error) {
      console.error('Failed to upload and record media:', error);
      res
        .status(500)
        .json({ error: 'Internal Server Error', details: error.message });
    } finally {
    }
  }
);

router.get('/data/:personId', getPersonWithWorksAndMediaById);
router.get('/work/:workId', getWorkWithMediaById);
router.put('/work/:workId', updateWorkById);
router.delete('/work/:workId', deleteWorkById);
// Route to delete a single person
router.delete('/:personId', deletePerson);

export default router;
