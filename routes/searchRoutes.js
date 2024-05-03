import express from 'express';
import { searchItems } from '../controllers/searchResultController.js';

const router = express.Router();

router.post('/', searchItems);

export default router;
