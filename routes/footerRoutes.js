import express from "express";
import {
  getFooterData,
  updateFooterConfig,
  uploadMiddleware,
} from "../controllers/footerController.js";

import { verifyToken } from "../middleware/auth.js";
import { authorizeAdmin } from "../middleware/response-handler.js";
/* import { authorizeAdmin } from "../middleware/response-handler.js"; */

const router = express.Router();

router.get("/", getFooterData);

router.post("/", verifyToken, uploadMiddleware, updateFooterConfig);

export default router;
