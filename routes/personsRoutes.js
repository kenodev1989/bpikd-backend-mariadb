import express from 'express';

import { verifyToken } from '../middleware/auth.js';
import { authorizeAdmin } from '../middleware/response-handler.js';
import { upload } from '../middleware/upload.js';
import path from 'path';
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

const router = express.Router();

router.route('/').post(verifyToken, upload, addOrUpdatePersonAndWork);

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

router.delete('/media/:mediaId', deleteMediaById);

// POST route to handle media uploads for a specific work
router.post('/work/:workId/media', uploadMedia, async (req, res) => {
  const workId = req.params.workId;
  let media = { images: [], videos: [], audios: [], documents: [] };

  let conn;
  try {
    conn = await pool.getConnection(); // Ensure pool is defined and imported properly

    const promises = [];
    ['images', 'videos', 'audios', 'documents'].forEach((type) => {
      if (req.files && req.files[type]) {
        req.files[type].forEach((file) => {
          const url = `${req.protocol}://${req.get('host')}/uploads/${type}/${
            file.filename
          }`;
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
                mediaItem.mediaId = insertResult.insertId.toString(); // Assuming insertId is available
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
});

router.get('/data/:personId', getPersonWithWorksAndMediaById);
router.get('/work/:workId', getWorkWithMediaById);
router.put('/work/:workId', updateWorkById);
router.delete('/work/:workId', deleteWorkById);
// Route to delete a single person
router.delete('/:personId', deletePerson);

export default router;
