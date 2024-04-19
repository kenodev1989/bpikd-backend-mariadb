// Importing modules using ES6/ES7 syntax
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import routes from "./routes/routes.js";
import pool from "./db/config.js"; // Make sure your routes file exports the routes using ES6 export syntax

dotenv.config();

// Connecting to the database
const connectDB = async () => {
  try {
    const conn = await pool.getConnection();
    if (conn) console.log("MariaDB Connected!");
    conn.release(); // release to pool
  } catch (err) {
    console.error(err);
  }
};

connectDB();

const app = express();

// CORS middleware setup to allow requests from specified origins
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  next();
});

// Express middleware for parsing requests
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ limit: "5mb" }));
app.use(express.json());
app.use(cors());

// Using routes
app.use("/", routes);

const PORT = process.env.PORT || 3000; // Providing a default port if none specified

// Starting the server
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
});

/*  "works": [
        {
            "title": "Bašta sljezove boje",
            "content": "h created an obstacle as this would violate laws forbidding German arms sales to  the Middle East.",
            "publishTime": "Now",
            "isPublished": true,
            "scheduledPublishTime": "2024-04-01T13:50:36.161Z",
            "externalSource": null,
            "media": [
                {
                    "images": [
                        {
                            "url": "https://bpikd-backend-test.up.railway.app/uploads/images-1711979436183.png",
                            "_id": "660abbacf30948c5b8041ab5"
                        }
                    ],
                    "audios": [
                        {
                            "url": "https://bpikd-backend-test.up.railway.app/uploads/audios-1711979436184.mp3",
                            "name": "[DEMO 30 seconds] Piloti - Kao ptica na mom dlanu (lyrics).mp3",
                            "fileType": "audio/mpeg",
                            "_id": "660abbacf30948c5b8041ab6"
                        }
                    ],
                    "videos": [],
                    "documents": [],
                    "_id": "660abbacf30948c5b8041ab4"
                }
            ], */
