import pool from "../db/config.js";
import * as schedule from "node-schedule";
import moment from "moment-timezone";
import { baseRoute } from "../helpers/config.js";

/**
 * Schedules a job to set isPublished to true at a specified UTC time.
 * @param {string} workId - The ID of the work item to publish.
 * @param {Date} scheduledTimeUTC - The UTC time when the work should be published.
 * @param {Pool} dbPool - The database connection pool.
 */

let protocol = process.env.PROTOCOL;

async function schedulePublication(workId, scheduledTimeUTC, dbPool) {
  schedule.scheduleJob(workId.toString(), scheduledTimeUTC, async function () {
    const conn = await dbPool.getConnection();

    try {
      await conn.query("UPDATE news SET isPublished = 1 WHERE id = ?", [
        workId,
      ]);
    } catch (error) {
    } finally {
      if (conn) {
        conn.release();
      }
    }
  });
}

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
    featuredImage = `${protocol}://${req.get("host")}/${baseRoute}/uploads/${
      file.filename
    }`;
  } else {
    featuredImage = null; // Handle the case where there's no featured image
  }

  const scheduledTimeUTC = moment
    .tz(scheduledPublishTime, "Europe/Berlin")
    .utc()
    .toDate();

  // Current time in UTC as a Date object
  const currentTimeUTC = new Date();

  const validScheduledTime = scheduledTimeUTC > currentTimeUTC;

  // Check if the scheduled time is in the future
  let publishStatus = isPublished;

  if (publishTime === "Scheduled" && validScheduledTime) {
    publishStatus = false; // Set isPublished to false for future scheduled posts
  } else {
    publishStatus = true;
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
        publishTime,
        scheduledTimeUTC ? scheduledTimeUTC : null,
        externalSource,
        visibility,
        publishStatus,
        featuredImage,
        "admin",
      ]
    );

    if (!publishStatus && validScheduledTime) {
      // Schedule a job to publish the work at the specified UTC time
      schedulePublication(result.insertId, scheduledTimeUTC, pool);
    }

    const newsItemId = result.insertId.toString(); // Convert BigInt to String to prevent serialization error

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
  const { personIds } = req.body;

  const postIds = personIds;

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

export const addOrUpdatePagesPost = async (req, res) => {
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
    title,
    content,
    publishTime,
    scheduledPublishTime,
    externalSource,
    visibility,
    isPublished,
    featured,
    category,
  } = data;

  let featuredImage;
  if (req.files?.featuredImage?.[0]) {
    const file = req.files.featuredImage[0];
    featuredImage = `${protocol}://${req.get("host")}/${baseRoute}/uploads/${
      file.filename
    }`;
  } else {
    featuredImage = null;
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    const path = data.category.toLowerCase();

    const [existing] = await conn.query(`SELECT id FROM ${path} LIMIT 1`);

    let postId = existing ? existing.id : null;

    if (postId) {
      await conn.query(
        `UPDATE ${path} SET 
        title=?, content=?, publishTime=?, scheduledPublishTime=?,
        externalSource=?, visibility=?, isPublished=?, featured=? ,category=?, createdBy='admin'
        WHERE id=?`,
        [
          title,
          content,
          publishTime,
          scheduledPublishTime ? new Date(scheduledPublishTime) : null,
          externalSource,
          visibility,
          isPublished,
          featuredImage,
          category,
          existing.id,
        ]
      );
    } else {
      await conn.query(
        `INSERT INTO ${path} 
        (title, content, publishTime, scheduledPublishTime, externalSource, 
        visibility, isPublished, featured, category, createdBy) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?,?, 'admin')`,
        [
          title,
          content,
          publishTime ? new Date(publishTime) : null,
          scheduledPublishTime ? new Date(scheduledPublishTime) : null,
          externalSource,
          visibility,
          isPublished,
          featuredImage,
          category,
        ]
      );
    }

    await conn.commit();
    res.json({ message: "Page post updated successfully" });
  } catch (error) {
    await conn.rollback();
    console.error("Failed to add or update about post:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

/* export const getPagePost = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query("SELECT * FROM about LIMIT 1");
    if (rows.length === 0) {
      res.status(404).json({ message: "About post not found" });
    } else {
      res.json(rows);
    }
  } catch (error) {
    console.error("Error fetching about post:", error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    if (conn) conn.release();
  }
};
 */

export const getNewsByCategory = async (req, res) => {
  let conn;
  try {
    // Retrieve the 'category' from the query parameters
    const { category } = req.params;

    // Check if 'category' query parameter is provided
    if (!category) {
      return res
        .status(400)
        .json({ message: "Category parameter is required" });
    }

    conn = await pool.getConnection();
    // Using parameterized query to prevent SQL injection
    const query =
      "SELECT * FROM news WHERE category = ? ORDER BY created_at DESC";
    const rows = await conn.query(query, [category]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No news found for this category" });
    }

    res.json(rows);
  } catch (error) {
    console.error("Error fetching news items:", error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    if (conn) conn.release(); // Always release the connection
  }
};

export const getPagePost = async (req, res) => {
  const category = req.params.category;
  const allowedTables = ["about", "button1", "button2", "soon", "shop"]; // list of allowed tables to prevent SQL injection
  let conn;

  if (!allowedTables.includes(category)) {
    return res.status(400).json({ message: "Invalid category" });
  }

  try {
    conn = await pool.getConnection();
    const safeCategory = conn.escapeId(category); // Escaping identifier to prevent SQL Injection
    const query = `SELECT * FROM ${safeCategory} LIMIT 1`;
    const [rows] = await conn.query(query, [category]); // Safely passing table name as a parameter

    if (rows.length === 0) {
      res.status(404).json({ message: `${category} post not found` });
    } else {
      res.json(rows);
    }
  } catch (error) {
    console.error(`Error fetching ${category} post:`, error);
    res.status(500).json({ message: "Internal Server Error" });
  } finally {
    if (conn) conn.release();
  }
};

export const updateNewsById = async (req, res) => {
  const { id } = req.params;

  let data;
  try {
    data = JSON.parse(req.body.data);
  } catch (error) {
    console.error("Error parsing data:", error);
    return res.status(400).json({ error: "Invalid JSON data provided." });
  }

  const {
    title,
    content,
    publishTime,
    isPublished,
    scheduledPublishTime,
    externalSource,
    category,
    featured,
  } = data;

  let conn;
  try {
    conn = await pool.getConnection();

    // Optionally fetch the current data first to preserve the existing featured image

    /*    let featuredImage = current?.featured; // Use existing featured image if no new file is uploaded
     */
    let featuredImage;
    if (req.files?.featuredImage?.[0]) {
      const file = req.files.featuredImage[0];
      featuredImage = `${protocol}://${req.get("host")}/${baseRoute}/uploads/${
        file.filename
      }`;
    } else {
      featuredImage = null; // Or handle keeping the old image if needed
    }

    const scheduledTimeUTC = moment
      .tz(scheduledPublishTime, "Europe/Berlin")
      .utc()
      .toDate();

    // Current time in UTC as a Date object
    const currentTimeUTC = new Date();

    const validScheduledTime = scheduledTimeUTC > currentTimeUTC;

    // Check if the scheduled time is in the future
    let publishStatus = isPublished;
    if (publishTime === "Scheduled" && validScheduledTime) {
      publishStatus = false; // Set isPublished to false for future scheduled posts
    } else {
      publishStatus = true;
    }

    const query = `
      UPDATE news SET
      title = ?,
      content = ?,
      featured = ?,
      publishTime = ?,
      isPublished = ?,
      scheduledPublishTime = ?,
      externalSource = ?,
      category = ?
      WHERE id = ?;
    `;
    const params = [
      title,
      content,
      featuredImage,
      publishTime,
      publishStatus,
      scheduledTimeUTC ? scheduledTimeUTC : null,
      externalSource,
      category,
      id,
    ];

    const result = await conn.query(query, params);

    if (!publishStatus && validScheduledTime) {
      // Schedule a job to publish the work at the specified UTC time
      schedulePublication(params[8], scheduledTimeUTC, pool);
    }

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: "No news post found with given ID" });
    }
    res.json({ message: "Post updated successfully" });
  } catch (error) {
    console.error("Failed to update news post:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: error.message });
  } finally {
    if (conn) conn.release();
  }
};
