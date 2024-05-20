import { generateToken } from '../utils/generateToken.js';
import model from '../models/admin.js';
import * as validator from '../validator/admin.js';
import {
  errorHandler,
  responseHandler,
} from '../middleware/response-handler.js';
import {
  findOne,
  create,
  findOneAndUpdate,
  findOneAndDelete,
} from '../dal/dal.js';
import bcrypt from 'bcryptjs';

export async function register(req, res) {
  console.log(req, res);
  try {
    const { error, value } = validator.signUpSchema.validate(
      req.body,
      validator.defaults
    );
    if (error) {
      return errorHandler(403, res, error.message);
    }

    const passwordHash = await bcrypt.hash(value.password, 10);

    const body = {
      ...value,
      password: passwordHash,
    };

    const user = await create(model, body);
    const accessToken = await generateToken(user);
    const data = {
      user: user,
      token: accessToken,
    };

    responseHandler(data, res, 'Admin Registered Successfully!', 201);
  } catch (err) {
    console.log(err);
    errorHandler(500, res, err.message);
  }
}

export async function login(req, res) {
  try {
    const { error, value } = validator.logInSchema.validate(
      req.body,
      validator.defaults
    );
    if (error) {
      return errorHandler(403, res, error.message);
    }

    const user = await findOne(
      model,
      { username: value.username },
      { password: 1, username: 1, email: 1 }
    );
    if (!user) {
      return errorHandler(404, res, 'User Not Found!');
    }
    const allGood = await bcrypt.compare(value.password, user.password);

    if (user && allGood) {
      const accessToken = await generateToken(user);
      responseHandler({ user: user, token: accessToken }, res);
    } else {
      errorHandler(401, res, 'Alert! Wrong Credentials.');
    }
  } catch (err) {
    console.log(err);
    errorHandler(500, res, err.message);
  }
}

export async function getUser(req, res) {
  try {
    const user = await findOne(model, { _id: req.user._id });
    user ? responseHandler(user, res) : errorHandler(404, res, 'No user!');
  } catch (err) {
    console.log(err);
    errorHandler(500, res, err.message);
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

    const user = await findOneAndUpdate(model, { _id: req.user._id }, value);
    user ? responseHandler(user, res) : errorHandler(404, res, 'No user!');
  } catch (err) {
    console.log(err);
    errorHandler(500, res, err.message);
  }
}

// Assuming you have a function in your DAL or you can directly use the model
// For example, let's say you have this in your dal.js
// export async function findAll(model) {
//   return await model.find({});
// }

// Import findAll if you're using a separate DAL function
// If not, you'll use the model directly

/* export async function getAllUsers(req, res) {
  try {
    // Directly using model.find() if not using a separate DAL function
    const users = await model.find({}).select("-password"); // Exclude passwords from the response
    if (users) {
      responseHandler(users, res, "Users fetched successfully", 200);
    } else {
      errorHandler(404, res, "No users found");
    }
  } catch (err) {
    console.log(err);
    errorHandler(500, res, "An error occurred while fetching users");
  }
} */

export async function getAllUsers(req, res) {
  try {
    // Query to fetch users with "user" or "editor" roles
    const users = await model
      .find({
        role: { $in: ['user', 'editor'] },
      })
      .select('-password'); // Exclude passwords from the response for security

    if (users && users.length > 0) {
      responseHandler(users, res, 'Users fetched successfully', 200);
    } else {
      errorHandler(404, res, 'No users found');
    }
  } catch (err) {
    console.log(err);
    errorHandler(500, res, 'An error occurred while fetching users');
  }
}

export async function deleteUser(req, res) {
  try {
    const user = await findOneAndDelete(model, { _id: req.user._id });
    user ? responseHandler(user, res) : errorHandler(404, res, 'No user!');
  } catch (err) {
    console.log(err);
    errorHandler(500, res, err.message);
  }
}
