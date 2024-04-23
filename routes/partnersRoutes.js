import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import pool from "../db/config.js"; // Ensure your database configuration is correctly imported

const router = express.Router();

const storage = multer.diskStorage({
  destination: "./public/uploads/partners",
  filename: function (req, file, cb) {
    const match = file.fieldname.match(/partnersImages-(\d+)/);
    const index = match ? match[1] : "default";
    const fileExtension = path.extname(file.originalname);
    const filename = `partnersImages-${index}${fileExtension}`;
    cb(null, filename);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    if (
      filetypes.test(path.extname(file.originalname).toLowerCase()) &&
      filetypes.test(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed! (JPEG, JPG, PNG, GIF)"));
    }
  },
}).fields([
  { name: "partnersImages-0", maxCount: 1 },
  { name: "partnersImages-1", maxCount: 1 },
  { name: "partnersImages-2", maxCount: 1 },
  { name: "partnersImages-3", maxCount: 1 },
  { name: "partnersImages-4", maxCount: 1 },
  { name: "partnersImages-5", maxCount: 1 },
  { name: "partnersImages-6", maxCount: 1 },
  { name: "partnersImages-7", maxCount: 1 },
  { name: "partnersImages-8", maxCount: 1 },
  { name: "partnersImages-9", maxCount: 1 },
  { name: "partnersImages-10", maxCount: 1 },
  { name: "partnersImages-11", maxCount: 1 },
  { name: "partnersImages-12", maxCount: 1 },
  { name: "partnersImages-13", maxCount: 1 },
  { name: "partnersImages-14", maxCount: 1 },
  { name: "partnersImages-15", maxCount: 1 },
  { name: "partnersImages-16", maxCount: 1 },
  { name: "partnersImages-17", maxCount: 1 },
  { name: "partnersImages-18", maxCount: 1 },
  { name: "partnersImages-19", maxCount: 1 },
  { name: "partnersImages-20", maxCount: 1 },
]);

router.post("/", upload, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();

    conn.query("DELETE FROM partners", (error, results, fields) => {
      if (error) throw error;
      console.log("Deleted " + results.affectedRows + " rows");

      // Reset AUTO_INCREMENT counter
    });

    const files = req.files;
    let values = [];
    let activePaths = [];

    for (const field in files) {
      files[field].forEach((file) => {
        const filePath = `${req.protocol}://${req.get(
          "host"
        )}/uploads/partners/${file.filename}`;
        activePaths.push(filePath);
        values.push(filePath, new Date());
      });
    }

    if (values.length === 0) {
      throw new Error("No files uploaded");
    }

    const placeholders = Array(values.length / 2)
      .fill("(?, ?)")
      .join(", ");
    const query = `INSERT INTO partners (imagePath, createdAt) VALUES ${placeholders}
                       ON DUPLICATE KEY UPDATE imagePath=VALUES(imagePath), createdAt=VALUES(createdAt)`;

    await conn.query(query, values);

    // Delete unused entries
    const [existingEntries] = await conn.query(
      "SELECT id, imagePath FROM partners"
    );
    console.log([existingEntries]);
    const existingPaths = existingEntries.map((entry) => entry.imagePath);
    const toDelete = existingPaths.filter(
      (path) => !activePaths.includes(path)
    );

    if (toDelete.length > 0) {
      await conn.query("DELETE FROM partners WHERE imagePath IN (?)", [
        toDelete,
      ]);
    }

    res.json({
      message: "Files uploaded and database updated successfully",
      updatedPaths: activePaths,
      deletedPaths: toDelete,
    });
  } catch (error) {
    console.error("Error in operation:", error);
    res.status(500).json({ message: "Server error", error: error.toString() });
  } finally {
    if (conn) conn.release();
  }
});

/* router.post("/", upload, async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction(); // Start a transaction

    const images = JSON.parse(req.body.images); // Assuming the metadata is sent under the 'images' field as a JSON string
    let fileData = {};

    // Process files first, storing paths in a map
    if (req.files) {
      req.files.forEach((file, index) => {
        fileData[index] = `${req.protocol}://${req.get(
          "host"
        )}/uploads/partners/${file.filename}`;
      });
    }

    let activeIds = [];

    // Process each image metadata entry
    images.forEach((image, index) => {
      const filePath = fileData[index] || image.imagePath; // Use uploaded file path if available

      if (image.id) {
        // Existing image, update it
        conn.query(
          "UPDATE partners SET imagePath = ?, updatedAt = NOW() WHERE id = ?",
          [filePath, image.id]
        );
        activeIds.push(image.id);
      } else {
        // New image, insert it
        const results = conn.query(
          "INSERT INTO partners (imagePath, createdAt) VALUES (?, NOW())",
          [filePath]
        );
        activeIds.push(results.insertId); // Assuming 'results.insertId' is supported by your SQL driver
      }
    });

    // Remove any entries that are not in the active list
    if (activeIds.length > 0) {
      conn.query("DELETE FROM partners WHERE id NOT IN (?)", [activeIds]);
    }

    await conn.commit(); // Commit the transaction
    res.json({
      message: "Images processed successfully",
      activeIds: activeIds,
    });
  } catch (error) {
    await conn.rollback(); // Rollback the transaction on errors
    console.error("Error during image processing:", error);
    res.status(500).json({ message: "Server error", error: error.toString() });
  } finally {
    if (conn) conn.release(); // Always release the connection
  }
}); */

router.get("/", async (req, res) => {
  let conn;
  try {
    // Establish a connection from the pool
    conn = await pool.getConnection();
    const query = "SELECT * FROM partners";
    const results = await conn.query(query);

    console.log("Number of records fetched:", results.length);
    console.log("Records:", results);

    if (results.length === 0) {
      // Properly handle the case where no records are found
      return res.status(404).json({ message: "No partners found" });
    }

    // Return all the fetched records properly formatted as JSON
    res.json({
      message: "Successfully retrieved partners data",
      results,
    });
  } catch (error) {
    // Log and return any errors encountered during the operation
    console.error("Error fetching partners data:", error);
    res.status(500).json({ message: "Server error", error: error.toString() });
  } finally {
    // Always release the connection back to the pool
    if (conn) {
      conn.release();
    }
  }
});

export default router;
