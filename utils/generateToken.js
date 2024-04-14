import jwt from "jsonwebtoken";

export const generateToken = (user) => {
  return jwt.sign(
    {
      _id: user._id,
      role: user.role, // Include user's role or any other user-specific info you need
      // Add other fields as needed
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "4h", // Token expiration time
    }
  );
};
