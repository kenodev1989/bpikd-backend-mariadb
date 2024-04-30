import pool from '../db/config.js';
import cron from 'node-cron';
import moment from 'moment-timezone';

// Add news controller

export const addNews = async (req, res) => {
  let data;

  try {
    if (typeof req.body.data === 'string') {
      data = JSON.parse(req.body.data);
    } else {
      data = req.body;
    }
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON data provided.' });
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
    featuredImage = `${req.protocol}://${req.get('host')}/uploads/${
      file.filename
    }`;
  } else {
    featuredImage = null; // Handle the case where there's no featured image
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query(
      'INSERT INTO news (category, title, content, publishTime, scheduledPublishTime, externalSource, visibility, isPublished, featured, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        category,
        title,
        content,
        publishTime,
        new Date(scheduledPublishTime),
        externalSource,
        visibility,
        isPublished,
        featuredImage,
        'admin',
      ]
    );
    const newsItemId = result.insertId.toString(); // Convert BigInt to String to prevent serialization error

    // Use custom logic to handle scheduled tasks if necessary
    // For example, using a simple timeout to simulate delayed publication (just for demonstration purposes)
    /* if (publishTime === 'Schedule' && scheduledPublishTime) {
      setTimeout(() => {
        console.log('Publishing scheduled news item:', newsItemId);
        // Additional publishing logic here
      }, new Date(scheduledPublishTime) - new Date());
    } */

    res.json({ ...data, id: newsItemId }); // Include the news item ID in the response
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) conn.release();
  }
};

export const getAllNews = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection(); // Assuming 'pool' is your MariaDB connection pool
    const rows = await conn.query(
      'SELECT * FROM news ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching news items:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    if (conn) conn.release(); // always release the connection
  }
};

export const getNewsById = async (req, res) => {
  let conn;
  try {
    const newsId = req.params.id; // Extract the news ID from the request parameters
    conn = await pool.getConnection();
    const rows = await conn.query('SELECT * FROM news WHERE id = ?', [newsId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'News item not found' });
    }

    res.json(rows[0]); // send the first row of the results
  } catch (error) {
    console.error('Error fetching news item:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  } finally {
    if (conn) conn.release();
  }
};

export async function deleteNewsPost(req, res) {
  let conn;
  try {
    const { postId } = req.params; // Assuming the post ID to delete is passed as a URL parameter (e.g., /news/:postId)

    conn = await pool.getConnection();
    const result = await conn.query('DELETE FROM news WHERE id = ?', [postId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'News post not found.' });
    }

    // News post deleted successfully
    res.json({ message: 'News post deleted successfully.' });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: 'An error occurred while deleting the news post.' });
  } finally {
    if (conn) {
      conn.release();
    }
  }
}

export const deleteMultipleNewsPosts = async (req, res) => {
  console.log('Received request body for deletion:', req.body); // Log the entire body to see what's received

  const { personIds } = req.body;

  const postIds = personIds;
  console.log('Received post IDs for deletion:', postIds);

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction(); // Start transaction

    if (postIds && postIds.length) {
      console.log('Deleting news posts with IDs:', postIds);
      const result = await conn.query('DELETE FROM news WHERE id IN (?)', [
        postIds,
      ]);
      await conn.commit(); // Commit the transaction
      console.log(`Deleted ${result.affectedRows} news posts successfully.`);
      res.json({
        message: `${result.affectedRows} news posts have been successfully deleted.`,
      });
    } else {
      res.status(400).json({ message: 'No post IDs provided for deletion.' });
    }
  } catch (error) {
    await conn.rollback(); // Rollback on error
    console.error('Failed to delete multiple news posts:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) {
      conn.release(); // Always release connection
    }
  }
};

export const addOrUpdatePagesPost = async (req, res) => {
  let data;

  try {
    if (typeof req.body.data === 'string') {
      data = JSON.parse(req.body.data);
    } else {
      data = req.body;
    }
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON data provided.' });
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
    featuredImage = `${req.protocol}://${req.get('host')}/uploads/${
      file.filename
    }`;
  } else {
    featuredImage = null;
  }

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    console.log(data);

    const path = data.category.toLowerCase();

    console.log(path);

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
          publishTime ? new Date(publishTime) : null,
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
    res.json({ message: 'Page post updated successfully' });
  } catch (error) {
    await conn.rollback();
    console.error('Failed to add or update about post:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
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

export const getPagePost = async (req, res) => {
  const category = req.params.category;
  const allowedTables = ['about', 'button1', 'button2', 'soon', 'shop']; // list of allowed tables to prevent SQL injection
  let conn;

  if (!allowedTables.includes(category)) {
    return res.status(400).json({ message: 'Invalid category' });
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
    res.status(500).json({ message: 'Internal Server Error' });
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
    console.error('Error parsing data:', error);
    return res.status(400).json({ error: 'Invalid JSON data provided.' });
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

  console.log(req.files);

  let conn;
  try {
    conn = await pool.getConnection();

    // Optionally fetch the current data first to preserve the existing featured image

    /*    let featuredImage = current?.featured; // Use existing featured image if no new file is uploaded
     */
    let featuredImage;
    if (req.files?.featuredImage?.[0]) {
      const file = req.files.featuredImage[0];
      featuredImage = `${req.protocol}://${req.get('host')}/uploads/${
        file.filename
      }`;
    } else {
      featuredImage = null; // Or handle keeping the old image if needed
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
      isPublished,
      new Date(scheduledPublishTime),
      externalSource,
      category,
      id,
    ];

    const result = await conn.query(query, params);
    console.log(result);

    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ message: 'No news post found with given ID' });
    }
    res.json({ message: 'Post updated successfully' });
  } catch (error) {
    console.error('Failed to update news post:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) conn.release();
  }
};
