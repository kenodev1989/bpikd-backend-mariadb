import pool from "../db/config.js";
import cron from "node-cron";
import moment from "moment-timezone";

// Add news controller

export const addNews = async (req, res) => {
  let data;

  try {
    if (typeof req.body.data === "string") {
      data = JSON.parse(req.body.data);
    } else {
      data = req.body;
    }
  } catch (error) {
    return res.status(400).json({ error: "Invalid JSON data provided." });
  }

  const {
    category,
    title,
    content,
    publishTime,
    scheduledPublishTime,
    externalSource,
    visibility,
    isPublished,
  } = data;

  let featuredImage;
  if (req.files?.featuredImage?.[0]) {
    const file = req.files.featuredImage[0];
    featuredImage = `${req.protocol}://${req.get("host")}/uploads/${
      file.filename
    }`;
  } else {
    featuredImage = null; // Handle the case where there's no featured image
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query(
      "INSERT INTO news (category, title, content, publishTime, scheduledPublishTime, externalSource, visibility, isPublished, featured, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        category,
        title,
        content,
        new Date(publishTime),
        new Date(scheduledPublishTime),
        externalSource,
        visibility,
        isPublished,
        featuredImage,
        "admin",
      ]
    );
    const newsItemId = result.insertId.toString(); // Convert BigInt to String to prevent serialization error

    // Use custom logic to handle scheduled tasks if necessary
    // For example, using a simple timeout to simulate delayed publication (just for demonstration purposes)
    if (publishTime === "Schedule" && scheduledPublishTime) {
      setTimeout(() => {
        console.log("Publishing scheduled news item:", newsItemId);
        // Additional publishing logic here
      }, new Date(scheduledPublishTime) - new Date());
    }

    res.json({ ...data, id: newsItemId }); // Include the news item ID in the response
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  } finally {
    if (conn) conn.release();
  }
};

export const getAllNews = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection(); // Assuming 'pool' is your MariaDB connection pool
    const rows = await conn.query(
      "SELECT * FROM news ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error("Error fetching news items:", error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    if (conn) conn.release(); // always release the connection
  }
};

export const getNewsById = async (req, res) => {
  let conn;
  try {
    const newsId = req.params.id; // Extract the news ID from the request parameters
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT * FROM news WHERE id = ?", [newsId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: "News item not found" });
    }

    res.json(rows[0]); // send the first row of the results
  } catch (error) {
    console.error("Error fetching news item:", error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    if (conn) conn.release();
  }
};

export async function deleteNewsPost(req, res) {
  let conn;
  try {
    const { postId } = req.params; // Assuming the post ID to delete is passed as a URL parameter (e.g., /news/:postId)

    conn = await pool.getConnection();
    const result = await conn.query("DELETE FROM news WHERE id = ?", [postId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "News post not found." });
    }

    // News post deleted successfully
    res.json({ message: "News post deleted successfully." });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "An error occurred while deleting the news post." });
  } finally {
    if (conn) {
      conn.release();
    }
  }
}

export const deleteMultipleNewsPosts = async (req, res) => {
  console.log("Received request body for deletion:", req.body); // Log the entire body to see what's received

  const { personIds } = req.body;

  const postIds = personIds;
  console.log("Received post IDs for deletion:", postIds);

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction(); // Start transaction

    if (postIds && postIds.length) {
      console.log("Deleting news posts with IDs:", postIds);
      const result = await conn.query("DELETE FROM news WHERE id IN (?)", [
        postIds,
      ]);
      await conn.commit(); // Commit the transaction
      console.log(`Deleted ${result.affectedRows} news posts successfully.`);
      res.json({
        message: `${result.affectedRows} news posts have been successfully deleted.`,
      });
    } else {
      res.status(400).json({ message: "No post IDs provided for deletion." });
    }
  } catch (error) {
    await conn.rollback(); // Rollback on error
    console.error("Failed to delete multiple news posts:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  } finally {
    if (conn) {
      conn.release(); // Always release connection
    }
  }
};
