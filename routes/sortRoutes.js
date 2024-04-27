import express from 'express';

import {
  getAllSortedItems,
  updateSortedItems,
} from '../controllers/sortItemController.js';

const router = express.Router();

router.get('/', getAllSortedItems);
router.put('/data', updateSortedItems);

export default router;
