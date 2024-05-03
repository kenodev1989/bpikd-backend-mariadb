import express from 'express';
import {
  getHeaderConfig,
  updateHeaderConfig,
  upload,
} from '../controllers/headerController.js';

const router = express.Router();

router.post('/updateHeader', upload.single('logoImg'), updateHeaderConfig);

router.get('/getHeader', getHeaderConfig);

export default router;
