// Import Joi using ES6 module syntax
import Joi from "joi";

// Define your schemas
const signUpSchema = Joi.object({
  firstname: Joi.string(),
  lastname: Joi.string(),
  nickname: Joi.string(),
  username: Joi.string().required(),
  email: Joi.string().required(),
  password: Joi.string().required(),
  role: Joi.string().required(),
});

const logInSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required(),
});

const updateSchema = Joi.object({
  firstname: Joi.string(),
  lastname: Joi.string(),
  nickname: Joi.string(),
  username: Joi.string(),
  email: Joi.string(),
  password: Joi.string(),
  role: Joi.string(),
});

// Define your defaults
const defaults = {
  abortEarly: false, // include all errors
  allowUnknown: true, // ignore unknown props
  stripUnknown: true, // remove unknown props
};

// Define a function to format messages
const message = (error) => `${error.details.map((x) => x.message).join(", ")}`;

// Export your schemas, defaults, and message function
export { signUpSchema, logInSchema, updateSchema, defaults, message };
