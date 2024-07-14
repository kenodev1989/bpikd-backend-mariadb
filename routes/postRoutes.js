import express from "express";

import { verifyToken } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";
import {
  addNews,
  addOrUpdatePagesPost,
  deleteMultipleNewsPosts,
  deleteNewsPost,
  getAllNews,
  getNewsById,
  updateNewsById,
  getNewsByCategory,
} from "../controllers/postController.js";

const router = express.Router();

router.post("/news", verifyToken, upload, addNews);
/* router.post("/about", verifyToken, upload, addOrUpdatePagesPost);
router.post("/button2", verifyToken, upload, addOrUpdatePagesPost);
router.post("/button1", verifyToken, upload, addOrUpdatePagesPost);
router.post("/shop", verifyToken, upload, addOrUpdatePagesPost); */

router.post("/news/delete-multiply", deleteMultipleNewsPosts);
router.get("/news", getAllNews);

router.post("/soon", verifyToken, upload, addOrUpdatePagesPost);

// Define the route with id to match only numeric values
router.get("/news/:id(\\d+)", getNewsById);

router.get("/news/:category", getNewsByCategory);
/* router.get("/page/:category", getPagePost); */
router.delete("/news/:postId", deleteNewsPost);
router.put("/news/:id", upload, updateNewsById);

export default router;
