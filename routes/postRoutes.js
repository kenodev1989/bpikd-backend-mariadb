import express from 'express';

import { verifyToken } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  addNews,
  addOrUpdatePagesPost,
  deleteMultipleNewsPosts,
  deleteNewsPost,
  getPagePost,
  getAllNews,
  getNewsById,
  updateNewsById,
} from '../controllers/postController.js';

const router = express.Router();

router.post('/news', verifyToken, upload, addNews);
router.post('/about', verifyToken, upload, addOrUpdatePagesPost);
router.post('/button2', verifyToken, upload, addOrUpdatePagesPost);
router.post('/shop', verifyToken, upload, addOrUpdatePagesPost);

router.post('/news/delete-multiply', deleteMultipleNewsPosts);
router.get('/news', getAllNews);

router.post('/soon', verifyToken, upload, addOrUpdatePagesPost);

router.get('/page/:category', getPagePost);
router.delete('/news/:postId', deleteNewsPost);
router.put('/news/:id', upload, updateNewsById);
router.get('/news/:id', getNewsById);

// Route to get all news items
/* router.get("/news", getAllNews); */

export default router;
