import express from "express";

import { verifyToken } from "../middleware/auth.js";
import { authorizeAdmin } from "../middleware/response-handler.js";
import { upload } from "../middleware/upload.js";

import {
  addOrUpdatePersonAndWork,
  deleteMultiplePersons,
  deletePerson,
  getAllPersonsWithData,
  getPersonBasics,
} from "../controllers/personController.js";

const router = express.Router();

router.route("/").post(verifyToken, upload, addOrUpdatePersonAndWork);

router.get("/basic", verifyToken, getPersonBasics);

router.get("/list", verifyToken, getAllPersonsWithData);
// Route to delete multiple persons
router.post("/delete-multiple", deleteMultiplePersons);

// Route to delete a single person
router.delete("/:personId", deletePerson);

export default router;
