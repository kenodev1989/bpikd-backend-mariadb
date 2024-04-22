import express from "express";
import {
  getFooterData,
  updateFooterConfig,
  upload,
} from "../controllers/footerController.js";

import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

router.get("/", getFooterData);

// Route that uses the upload
router.post(
  "/",
  verifyToken,
  (req, res, next) => {
    upload(req, res, function (err) {
      if (err) {
        // Handle errors from Multer here
        return res.status(400).json({ success: false, message: err.message });
      }
      // If everything went fine, move to the next middleware
      next();
    });
  },
  updateFooterConfig
);

export default router;
