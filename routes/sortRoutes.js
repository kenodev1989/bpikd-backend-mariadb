import express from "express";

import {
  getAllSortedItems,
  updateOrCreateSortItems,
} from "../controllers/sortItemController.js";

const router = express.Router();

router.get("/", getAllSortedItems);
router.put("/data", updateOrCreateSortItems);

export default router;
