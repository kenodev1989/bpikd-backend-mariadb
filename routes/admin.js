import express from "express";
import {
  login,
  register,
  getUser,
  updateUser,
  getAllUsers,
  handleDeleteMultipleUsers,
  handleDeleteUser,
  getUserByIdController,
} from "../controllers/adminController.js";
import { verifyToken } from "../middleware/auth.js";
import {
  authorizeAdmin,
  canCreateUser,
} from "../middleware/response-handler.js"; // Assuming this is authorization middleware

const router = express.Router();

// Setup routes
router
  .route("/user")
  .post(verifyToken, canCreateUser, register)
  .get(verifyToken, getUser)
  .put(verifyToken, updateUser);

// Route for creating users, applying role-based access control

router.route("/user/login").post(login); // User login
router.get("/user/list", verifyToken, getAllUsers);

router
  .route("/delete-multiply")
  .delete(verifyToken, authorizeAdmin, handleDeleteMultipleUsers); // User login

// Parameterized routes for user operations
router.get("/user/:id", verifyToken, getUserByIdController);
router.put("/user/:id", verifyToken, updateUser);
router.delete("/user/:id", verifyToken, authorizeAdmin, handleDeleteUser);
// Export the router using ES6 default export
export default router;
