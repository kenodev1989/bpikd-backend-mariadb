// Import mongoose using ES6 module syntax
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstname: {
      type: String,
    },
    lastname: {
      type: String,
    },
    nickname: {
      type: String,
    },
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ["admin", "editor", "user"],
      default: "user",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Export the model
export default mongoose.model("User", userSchema);
