import express from "express";

import { verifyToken } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  addNews,
  deleteMultipleNewsPosts,
  deleteNewsPost,
  getAllNews,
  getNewsById,
} from "../controllers/postController.js";

const router = express.Router();

router.post("/", verifyToken, upload, addNews);

router.get("/", getAllNews);
router.post("/delete-multiply", deleteMultipleNewsPosts);
router.delete("/:postId", deleteNewsPost);
router.get("/:id", getNewsById);

// Route to get all news items
/* router.get("/news", getAllNews); */

export default router;
