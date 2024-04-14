import jwt from "jsonwebtoken";
import { errorHandler } from "./response-handler.js";

export const verifyToken = (req, res, next) => {
  let token = req.headers.authorization;
  if (!token) {
    return errorHandler(res, 401, "Unauthorized: No token provided.");
  }

  try {
    if (token.startsWith("Bearer ")) {
      token = token.slice(7, token.length).trim();
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    errorHandler(res, 403, "Failed to authenticate token.");
  }
};
