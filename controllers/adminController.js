import * as adminDAL from "../dal/adminDAL.js";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/generateToken.js";
import {
  responseHandler,
  errorHandler,
} from "../middleware/response-handler.js";

export async function register(req, res) {
  try {
    // Destructure all necessary fields from req.body
    const { firstname, lastname, nickname, username, email, password, role } =
      req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare additional fields with defaults if not provided
    const verified = false; // Default verification status
    const now = new Date(); // Current timestamp for created_at and updated_at

    // Create user with all required and optional fields
    const user = await adminDAL.createUser({
      firstname,
      lastname,
      nickname,
      username,
      email,
      password: hashedPassword,
      role,
      verified,
      created_at: now,
      updated_at: now,
    });

    const token = await generateToken(user); // Generate a token for session/authentication

    // Constructing the success message based on user's role
    let successMessage = `${
      user.role.charAt(0).toUpperCase() + user.role.slice(1)
    } Registered Successfully!`;
    // Use the response handler to send a success response
    responseHandler(res, { user, token }, successMessage, 201);
  } catch (error) {
    // Catch the specific 'Email already exists' error and handle it
    if (error.message) {
      return res.status(409).json({ error: error.message }); // 409 Conflict might be a suitable status code
    }
    // For other types of errors, you might want to use your generic error handler
    errorHandler(res, 500, "An error occurred during registration.");
  }
}

export async function login(req, res) {
  try {
    const { username, password } = req.body;
    const user = await adminDAL.getUserByUsername(username); // Ensure this DAL function is implemented properly
    if (!user) {
      return errorHandler(res, 404, "User not found."); // Correctly pass status code before message
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return errorHandler(res, 401, "Password is incorrect."); // Correctly pass status code before message
    }

    const token = await generateToken(user); // Ensure this function is correctly implemented
    responseHandler(
      res,
      {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
        },
        token,
      },
      "Login successful.",
      200
    ); // Optionally only pass non-sensitive user info
  } catch (err) {
    console.log(err); // It's a good idea to log the actual error for debugging purposes
    errorHandler(res, 500, "Login failed."); // Correctly pass status code before message
  }
}

export async function getAllUsers(req, res) {
  try {
    const users = await adminDAL.getAllUsers();
    responseHandler(res, users, "Users fetched successfully.", 200);
  } catch (err) {
    errorHandler(res, "Failed to fetch users.", 500);
  }
}

export async function handleDeleteUser(req, res) {
  try {
    await adminDAL.deleteUser(req.params.id);
    res.json({ message: "User successfully deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting user" });
  }
}

export async function handleDeleteMultipleUsers(req, res) {
  try {
    const userIds = req.body.userIds; // Extract user IDs from request body
    await adminDAL.deleteMultipleUsers(userIds);
    res.json({
      message: `${userIds.length} users have been successfully deleted.`,
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "An error occurred while deleting users." });
  }
}

export async function getUser(req, res) {
  let conn;
  try {
    conn = await pool.getConnection();
    const results = await conn.query("SELECT * FROM users WHERE id = ?;", [
      req.user.id,
    ]);
    const user = results[0]; // Get the first result

    if (user) {
      responseHandler(user, res);
    } else {
      errorHandler(404, res, "No user!");
    }
  } catch (err) {
    console.error(err);
    errorHandler(500, res, err.message);
  } finally {
    if (conn) await conn.end();
  }
}

/* export const getUserById = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const results = await conn.query(
      "SELECT id, firstname, lastname, username, email, role, verified, created_at, updated_at FROM users WHERE id = ?;",
      [req.params.userId]
    );
    const user = results[0]; // Get the first result

    if (!user) {
      res.status(404).json({ message: "User not found" });
    } else {
      res.json(user);
    }
  } catch (err) {
    console.error("Error fetching user by ID:", err);
    res.status(500).json({ message: "Error fetching user details" });
  } finally {
    if (conn) await conn.end();
  }
}; */

// In UserController.js or a similar file
export async function getUserById(id) {
  try {
    const user = await adminDAL.getUserByIdFromDB(id);
    if (!user) {
      return null; // or throw an error or handle the "not found" case as appropriate
    }
    delete user.password; // Remove sensitive data if not needed for the response
    return user;
  } catch (error) {
    console.error("Error fetching user by ID in Controller:", error);
    throw error; // Handle errors or rethrow them after logging
  }
}

export async function updateUser(req, res) {
  try {
    const { error, value } = validator.updateSchema.validate(
      req.body,
      validator.defaults
    );
    if (error) {
      return errorHandler(403, res, error.message);
    }

    const isAdmin = req.user.role === "admin";
    const targetUserId =
      isAdmin && req.params.userId ? req.params.userId : req.user.id;

    // Hash new password if provided
    if (value.password) {
      value.password = await bcrypt.hash(value.password, 10);
    }

    // Update user data in the database
    const updatedUser = await adminDAL.updateUserById(targetUserId, value);
    if (!updatedUser) {
      return errorHandler(404, res, "No user found!");
    }

    // Remove password from user data before sending response
    const userDataToReturn = { ...updatedUser };
    delete userDataToReturn.password;

    responseHandler(res, userDataToReturn, "User updated successfully");
  } catch (err) {
    console.error(err);
    errorHandler(500, res, err.message);
  }
}

export const getUserByIdController = async (req, res) => {
  try {
    const { id } = req.params; // Extract the userId from route parameters
    const user = await getUserById(id); // Use the DAL function to fetch the user

    if (!user) {
      // If no user is found with the given ID, return a 404 error
      return res.status(404).json({ message: "User not found" });
    }

    // Return the user data if found
    res.json(user);
  } catch (err) {
    console.error("Error fetching user by ID:", err);
    // Handle potential errors, such as database errors
    res.status(500).json({ message: "Error fetching user details" });
  }
};
