import express from 'express';
import multer from 'multer';
import pool from '../db/config.js';
import { fileURLToPath } from 'url';
import util from 'util';

import fs from 'fs';
import path from 'path';

import bodyParser from 'body-parser';
import * as schedule from 'node-schedule';

import moment from 'moment-timezone';
import { slugify } from '../utils/slugify.js';
import { baseRoute } from '../helpers/config.js';

const app = express();
app.use(bodyParser.urlencoded({ extended: true })); // o

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const unlinkAsync = util.promisify(fs.unlink);

function serializeBigInt(key, value) {
  if (typeof value === 'bigint') {
    return value.toString(); // convert BigInt to string
  } else {
    return value; // return everything else unchanged
  }
}

let protocol = process.env.PROTOCOL;

/**
 * Schedules a job to set isPublished to true at a specified UTC time.
 * @param {string} workId - The ID of the work item to publish.
 * @param {Date} scheduledTimeUTC - The UTC time when the work should be published.
 * @param {Pool} dbPool - The database connection pool.
 */
async function schedulePublication(workId, scheduledTimeUTC, dbPool) {
  schedule.scheduleJob(workId.toString(), scheduledTimeUTC, async function () {
    const conn = await dbPool.getConnection();
    console.log(
      `Attempting to publish work ID: ${workId} at ${new Date().toISOString()}`
    );
    try {
      await conn.query('UPDATE works SET isPublished = 1 WHERE id = ?', [
        workId,
      ]);
      console.log(`Work with ID ${workId} has been published.`);
    } catch (error) {
      console.error('Failed to update publish status:', error);
    } finally {
      if (conn) {
        conn.release();
      }
    }
  });
}

export const addOrUpdatePersonAndWork = async (req, res) => {
  let conn;
  try {
    const data = JSON.parse(req.body.data);
    const {
      person: personData,
      category,
      title,
      content,
      publishTime,
      scheduledPublishTime,
      externalSource,
      visibility,
      isPublished,
    } = data;

    conn = await pool.getConnection();
    await conn.beginTransaction();

    let featuredImage =
      req.files && req.files.featuredImage && req.files.featuredImage[0]
        ? `${protocol}://${req.get('host')}/${baseRoute}/featured/${
            req.files.featuredImage[0].filename
          }`
        : null;

    const [existing] = await conn.query(
      'SELECT id FROM persons WHERE id = ? AND firstName = ? AND lastName = ?',
      [personData.id, personData.firstName, personData.lastName]
    );

    let personId = existing ? existing.id : null;

    if (personId) {
      if (featuredImage) {
        await conn.query('UPDATE persons SET featured = ? WHERE id = ?', [
          featuredImage,
          personId,
        ]);
      }
    } else {
      console.log('No existing person found, inserting new person'); // Confirm this logic branch
      const result = await conn.query(
        'INSERT INTO persons (firstName, lastName, aboutPerson, featured, createdBy, category, visibility) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          personData.firstName,
          personData.lastName,
          personData.aboutPerson,
          featuredImage,
          'admin',
          category,
          visibility,
        ]
      );
      personId = result.insertId;
    }

    const scheduledTimeUTC = moment
      .tz(scheduledPublishTime, 'Europe/Berlin')
      .utc()
      .toDate();

    // Current time in UTC as a Date object
    const currentTimeUTC = new Date();

    const validScheduledTime = scheduledTimeUTC > currentTimeUTC;

    // Check if the scheduled time is in the future
    let publishStatus = isPublished;
    if (publishTime === 'Scheduled' && validScheduledTime) {
      publishStatus = false; // Set isPublished to false for future scheduled posts
    }
    const workResult = await conn.query(
      'INSERT INTO works (person_id, title, content, publishTime, scheduledPublishTime, externalSource, visibility, isPublished, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        personId,
        title,
        content,
        publishTime,
        scheduledTimeUTC ? scheduledTimeUTC : null,
        externalSource || null,
        visibility,
        publishStatus,
        'admin',
      ]
    );

    const workId = workResult.insertId;

    if (!publishStatus && validScheduledTime) {
      // Schedule a job to publish the work at the specified UTC time
      schedulePublication(workId, scheduledTimeUTC, pool);
    }

    let media = { images: [], videos: [], audios: [], documents: [] };

    ['images', 'videos', 'audios', 'documents'].forEach((type) => {
      if (req.files && req.files[type]) {
        req.files[type].forEach((file) => {
          const filePath = `${protocol}://${req.get(
            'host'
          )}/${baseRoute}/${slugify(title)}/${type}/${slugify(
            file.originalname
          )}`;
          media[type].push({
            url: filePath,
            name: file.originalname,
            fileType: file.mimetype,
            type,
          });
          conn.query(
            'INSERT INTO media (work_id, url, name, fileType, type) VALUES (?, ?, ?, ?, ?)',
            [workId, filePath, file.originalname, file.mimetype, type]
          );
        });
      }
    });

    await conn.commit();
    res.json({
      message: 'Person and work added/updated successfully',
      personId: personId.toString(), // Handle BigInt correctly
      workId: workId.toString(),
    });
  } catch (error) {
    console.log(error);
    if (conn) {
      await conn.rollback();
      conn.release();
    }
    console.error('Failed to add/update person and work:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) {
      conn.release();
      console.log('Connection released.');
    }
  }
};

export const searchPersonsByPartialName = async (req, res) => {
  const { searchQuery } = req.query;

  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      SELECT id, firstName, lastName, featured
      FROM persons
      WHERE CONCAT(firstName, ' ', lastName) LIKE CONCAT('%', ?, '%')
        OR firstName LIKE CONCAT('%', ?, '%')
        OR lastName LIKE CONCAT('%', ?, '%');
    `;

    const results = await conn.query(query, [
      searchQuery,
      searchQuery,
      searchQuery,
    ]);

    if (!results) {
      res.status(404).json({ message: 'No users found.' });
      return;
    }

    if (Array.isArray(results)) {
      const users = results.map((user) => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        featured: user.featured,
      }));
      res.json(users);
    } else {
      res.status(500).json({ message: 'Error processing results.' });
    }
  } catch (error) {
    console.error('Search users by partial name error:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

export const getAllPersonsWithData = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
            SELECT 
                p.id as person_id,
                p.firstName,
                p.lastName,
                p.aboutPerson,
                p.featured,
                p.createdBy,
                p.created_at,
                w.id as work_id,
                w.title,
                w.content,
                w.publishTime,
                w.isPublished,
                w.scheduledPublishTime,
                w.externalSource,
                m.id as media_id,
                m.url,
                m.name,
                m.fileType
            FROM 
                persons p
            LEFT JOIN 
                works w ON p.id = w.person_id
            LEFT JOIN 
                media m ON w.id = m.work_id;
        `;
    const rows = await conn.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Failed to retrieve persons:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

export const getPersonBasics = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
            SELECT
                id,
                firstName,
                lastName,
                featured,
                aboutPerson
            FROM 
                persons;
        `;
    const rows = await conn.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Failed to retrieve person basics:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

export const deleteMultiplePersons = async (req, res) => {
  const { personIds } = req.body; // Expect an array of person IDs

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction(); // Start transaction

    // Log the query for debugging
    console.log('Deleting works for persons IDs:', personIds);
    await conn.query('DELETE FROM works WHERE person_id IN (?)', [personIds]);

    // Log the query for debugging
    console.log('Deleting persons with IDs:', personIds);
    const result = await conn.query('DELETE FROM persons WHERE id IN (?)', [
      personIds,
    ]);

    await conn.commit(); // Commit the transaction
    console.log(`Deleted ${result.affectedRows} persons successfully.`);
    res.json({
      message: `${result.affectedRows} persons and their works have been successfully deleted.`,
    });
  } catch (error) {
    await conn.rollback(); // Rollback on error
    console.error('Failed to delete multiple persons:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) {
      conn.release(); // Always release connection
    }
  }
};

export const getPersonWithWorksAndMedia = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    // Query to get all persons, their works, and media. Adjust table and column names as necessary.
    const query = `
            SELECT p.id as personId, p.firstName, p.lastName, p.aboutPerson, w.id as workId, w.title, w.content, w.publishTime, w.isPublished, w.scheduledPublishTime, w.externalSource,
                   m.id as mediaId, m.url, m.name as mediaName, m.fileType, m.type as mediaType
            FROM persons p
            LEFT JOIN works w ON p.id = w.person_id
            LEFT JOIN media m ON w.id = m.work_id
            ORDER BY p.id, w.id, m.id;
        `;

    const results = await conn.query(query);
    conn.release(); // Always release connection

    // Process the flat SQL results into nested JSON format
    const personsMap = new Map();

    results.forEach((row) => {
      if (!personsMap.has(row.personId)) {
        personsMap.set(row.personId, {
          id: row.personId,
          firstName: row.firstName,
          lastName: row.lastName,
          aboutPerson: row.aboutPerson,
          works: [],
        });
      }

      const person = personsMap.get(row.personId);
      let work = person.works.find((w) => w.id === row.workId);

      if (!work) {
        work = {
          id: row.workId,
          title: row.title,
          content: row.content,
          publishTime: row.publishTime,
          isPublished: row.isPublished,
          scheduledPublishTime: row.scheduledPublishTime,
          externalSource: row.externalSource,
          media: [],
        };
        person.works.push(work);
      }

      if (row.mediaId) {
        const mediaItem = {
          id: row.mediaId,
          url: row.url,
          name: row.mediaName,
          fileType: row.fileType,
          type: row.mediaType,
        };
        work.media.push(mediaItem);
      }
    });

    // Convert Map to array
    const persons = Array.from(personsMap.values());

    res.json(persons);
  } catch (error) {
    console.error('Failed to retrieve person data:', error);
    if (conn) conn.release();
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  }
};

export const updatePersonBasicById = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { personId } = req.params;

    const data = JSON.parse(req.body.data);

    const { firstName, lastName, aboutPerson, featured } = data;

    let featuredImage = req.file
      ? `${protocol}://${req.get('host')}/${baseRoute}/featured/${
          req.file.filename
        }`
      : featured;

    const query = `
            UPDATE persons
            SET firstName = ?,
                lastName = ?,
                featured = ?,
                aboutPerson = ?
            WHERE id = ?;
        `;
    // Execute the update operation using parameterized query
    const result = await conn.query(query, [
      firstName,
      lastName,
      featuredImage,
      aboutPerson,
      personId,
    ]);

    if (result.affectedRows === 0) {
      res.status(404).json({ error: 'Person not found or no change made' });
    } else {
      res.json({
        message: 'Person updated successfully',
        personId: personId,
        imageUrl: featuredImage,
      });
    }
  } catch (error) {
    console.error('Failed to update person by ID:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

// Configure multer to use a file name based on personId
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './public/featured/'); // Directory where files are saved
  },
  filename: function (req, file, cb) {
    const extension = file.originalname.split('.').pop();
    const personId = req.params.personId;
    // Assuming personId is in the route parameters
    cb(null, `person-${personId}.${extension}`);
  },
});

export const uploadPersonBasicFeature = multer({ storage: storage });

export const getPersonBasicsById = async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const { personId } = req.params; // Assuming the ID is passed in the route parameter

    const query = `
            SELECT
                id,
                firstName,
                lastName,
                featured,
                aboutPerson,
                scheduledPublishTime
            FROM 
                persons
            WHERE
                id = ?;
        `;
    const rows = await conn.query(query, [personId]); // Using parameterized queries to prevent SQL injection

    if (rows.length) {
      res.json(rows[0]); // Send back the first row if found
    } else {
      res.status(404).json({ error: 'Person not found' });
    }
  } catch (error) {
    console.error('Failed to retrieve person by ID:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

export const getPersonWithWorksById = async (req, res) => {
  const { personId } = req.params;

  let conn;
  try {
    conn = await pool.getConnection();

    const query = `
  SELECT 
    p.id AS personId, p.firstName, p.lastName, p.aboutPerson, p.featured,
    w.id AS workId, w.title
  FROM persons p
  LEFT JOIN works w ON p.id = w.person_id
  WHERE p.id = ?
  ORDER BY w.scheduledPublishTime DESC;
`;

    const rows = await conn.query(query, [personId]);

    if (!rows.length) {
      return res.status(404).json({ error: 'Person not found' });
    }

    // Build the response object
    let response = {
      personId: personId,
      firstName: rows[0].firstName,
      lastName: rows[0].lastName,
      aboutPerson: rows[0].aboutPerson,
      featured: rows[0].featured,
      works: [],
    };

    rows.forEach((row) => {
      if (row.workId) {
        // Ensuring that there is a work associated with the person
        response.works.push({
          workId: row.workId,
          title: row.title,
        });
      }
    });

    res.json(response);
  } catch (error) {
    console.error('Failed to retrieve person with works:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

// Assuming you use Node.js and MySQL/MariaDB driver

export const insertWorkView = async (workId, ipAddress) => {
  const today = new Date().toISOString().slice(0, 10); // Format today's date as YYYY-MM-DD

  let conn;
  try {
    conn = await pool.getConnection();
    // Check if the view already exists for today

    // Increment the work view count
    const updateQuery = `
                UPDATE works SET work_view_count = work_view_count + 1 WHERE id = ?
            `;
    await conn.query(updateQuery, [workId]);
  } catch (error) {
    console.error('Failed to log work view:', error);
    throw error; // Rethrowing the error for caller to handle
  } finally {
    conn.release();
  }
};

export const getPersonWithWorksAndMediaById = async (req, res) => {
  const { personId } = req.params; // assuming person ID is sent as a URL parameter
  const ipAddress = req.ip; // Get the IP address from the request
  const today = new Date().toISOString().slice(0, 10); // Get today's date in YYYY-MM-DD format

  let conn;
  try {
    conn = await pool.getConnection();

    const incrementViewCount = `
      UPDATE persons SET view_count = view_count + 1 WHERE id = ?
    `;
    await conn.query(incrementViewCount, [personId]);

    // Query to fetch person details, works, and associated media
    const query = `
  SELECT p.id AS personId, p.firstName, p.lastName, p.aboutPerson, p.featured, p.created_at,p.view_count,
         p.scheduledPublishTime AS personScheduledPublishTime, -- Aliased to personScheduledPublishTime
         w.id AS workId, w.title, w.content, w.publishTime, w.isPublished,
         w.scheduledPublishTime AS workScheduledPublishTime, -- Aliased to workScheduledPublishTime
         w.externalSource, w.work_view_count, 
         m.id AS mediaId, m.url, m.name AS mediaName, m.fileType, m.type
  FROM persons p
  LEFT JOIN works w ON p.id = w.person_id
  LEFT JOIN media m ON w.id = m.work_id
  WHERE p.id = ?
  ORDER BY w.scheduledPublishTime DESC, m.id;
`;

    const rows = await conn.query(query, [personId]);

    // Formatting the response to include media sorted by type under each work
    let response = {
      personId: personId,
      firstName: rows[0]?.firstName,
      lastName: rows[0]?.lastName,
      aboutPerson: rows[0]?.aboutPerson,
      featured: rows[0]?.featured,
      scheduledPublishTime: rows[0]?.personScheduledPublishTime,
      createdAt: rows[0]?.created_at,
      personViewCount: rows[0]?.view_count,
      works: [],
    };

    let currentWorkId = null;
    let work = {};

    rows.forEach((row) => {
      if (currentWorkId !== row.workId) {
        if (currentWorkId !== null) {
          response.works.push(work);
        }
        currentWorkId = row.workId;
        work = {
          workId: row.workId,
          title: row.title,
          content: row.content,
          publishTime: row.publishTime,
          isPublished: row.isPublished,
          scheduledPublishTime: row.workScheduledPublishTime,
          work_view_count: row.work_view_count,
          externalSource: row.externalSource,
          media: { images: [], videos: [], audios: [], documents: [] },
        };
      }
      if (row.mediaId) {
        work.media[row.type].push({
          mediaId: row.mediaId,
          url: row.url,
          name: row.mediaName,
          fileType: row.fileType,
        });
      }
    });
    if (work.workId) {
      response.works.push(work);
    }

    res.json(response);
  } catch (error) {
    console.error('Failed to retrieve person with works and media:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) conn.release();
  }
};

// Assuming you are using something like MySQL or PostgreSQL and have a connection pool configured
export const deleteWorkById = async (req, res) => {
  const { workId } = req.params;

  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query('DELETE FROM works WHERE id = ?', [workId]);

    if (result.affectedRows > 0) {
      res.json({ message: 'Work deleted successfully' });
    } else {
      res.status(404).json({ error: 'Work not found' });
    }
  } catch (error) {
    console.error('Failed to delete work by ID:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) {
      conn.release();
    }
  }
};

export const getWorkWithMediaById = async (req, res) => {
  const { workId } = req.params; // Get work ID from URL parameters

  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      SELECT w.id, w.title, w.content, w.person_id, w.publishTime, w.isPublished, w.scheduledPublishTime, w.externalSource, w.work_view_count, 
             m.id AS mediaId, m.url, m.name AS mediaName, m.fileType, m.type
      FROM works w
      LEFT JOIN media m ON w.id = m.work_id
      WHERE w.id = ?;
    `;
    const rows = await conn.query(query, [workId]);

    if (rows.length > 0) {
      let workDetails = {
        id: rows[0].id,
        title: rows[0].title,
        content: rows[0].content,
        person_id: rows[0].person_id,
        publishTime: rows[0].publishTime,
        isPublished: rows[0].isPublished,
        scheduledPublishTime: rows[0].scheduledPublishTime, // Adding scheduled publish time
        externalSource: rows[0].externalSource,
        work_view_count: rows[0].work_view_count,
        media: { images: [], videos: [], audios: [], documents: [] },
      };

      // Iterate over each row to populate the media arrays by type
      rows.forEach((row) => {
        if (row.mediaId) {
          let mediaType = row.type.toLowerCase(); // assuming 'type' is something like 'image', 'video', etc.
          if (workDetails.media.hasOwnProperty(mediaType)) {
            workDetails.media[mediaType].push({
              mediaId: row.mediaId,
              url: row.url,
              name: row.mediaName,
              fileType: row.fileType,
            });
          } else {
            // In case there are types not predefined
            workDetails.media[mediaType] = [
              {
                mediaId: row.mediaId,
                url: row.url,
                name: row.mediaName,
                fileType: row.fileType,
              },
            ];
          }
        }
      });

      res.json(workDetails); // Send the detailed work data back to the client
    } else {
      res.status(404).json({ error: 'Work not found' });
    }
  } catch (error) {
    console.error('Failed to retrieve work by ID:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) {
      conn.release(); // Always release connection
    }
  }
};

const mediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    let destPath;

    const { title } = req.params;

    const slugifyTitle = req.workTitle ? req.workTitle : slugify(title);

    if (file.fieldname === 'featuredImage') {
      // Special destination for featured images
      destPath = path.join(__dirname, '../public', 'featured');
    } else {
      const fileType = file.mimetype.split('/')[0];
      const folderMap = {
        image: 'images',
        video: 'videos',
        audio: 'audios',
        application: 'documents',
      };
      const folderName = folderMap[fileType] || 'others';
      destPath = path.join(
        __dirname,
        '../public/works',
        slugifyTitle,
        folderName
      );
    }

    fs.mkdir(destPath, { recursive: true }, (err) => {
      if (err) {
        return cb(err);
      }
      cb(null, destPath);
    });
  },
  filename: function (req, file, cb) {
    if (file.fieldname === 'featuredImage') {
      // Different filename format for featured images
      const extension = path.extname(file.originalname);

      cb(null, `person-${file.originalname}`);
      /* cb(null, `person-${file.originalname}`); */
    } else {
      // General case for other file types
      const slugifiedName = slugify(file.originalname);
      cb(null, `${slugifiedName}`);
    }
  },
});

export const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 10000000000000 },
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
}).fields([
  { name: 'images', maxCount: 20 },
  { name: 'videos', maxCount: 20 },
  { name: 'audios', maxCount: 20 },
  { name: 'documents', maxCount: 20 },
  { name: 'featuredImage', maxCount: 20 },
]);

// Check file type
function checkFileType(file, cb) {
  // Allowed ext
  const filetypes = /jpeg|jpg|png|gif|mp4|avi|mpeg|mp3|wav|pdf|doc|mov|docx/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb('Error: Files Only!');
  }
}

// controllers/workController.js
export const updateWorkById = async (req, res) => {
  const { workId } = req.params;
  const {
    title,
    content,
    publishTime,
    isPublished,
    scheduledPublishTime,
    externalSource,
    category,
  } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
        UPDATE works SET
        title = ?,
        content = ?,
        publishTime = ?,
        isPublished = ?,
        scheduledPublishTime = ?,
        externalSource = ?,
        category = ?
        WHERE id = ?;
        `;
    const result = await conn.query(query, [
      title,
      content,
      publishTime,
      isPublished,
      scheduledPublishTime,
      externalSource,
      category,
      workId,
    ]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'No work found with given ID' });
    }
    res.json({ message: 'Work updated successfully' });
  } catch (error) {
    console.error('Failed to update work:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) conn.release();
  }
};

// Import necessary modules
async function removeEmptyDirectories(directory) {
  try {
    const files = await fs.promises.readdir(directory);
    if (files.length === 0) {
      await fs.promises.rmdir(directory);
      console.log(`Removed empty directory: ${directory}`);
      // Optionally, recurse to remove parent directories if also empty
      await removeEmptyDirectories(path.dirname(directory));
    }
  } catch (err) {
    console.error(`Error removing directory ${directory}:`, err);
  }
}

export const deleteMediaById = async (req, res) => {
  const { mediaId } = req.params;
  let conn;

  try {
    conn = await pool.getConnection();
    const result = await conn.query('SELECT url FROM media WHERE id = ?', [
      mediaId,
    ]);

    // Check if any media was found
    if (result.length === 0) {
      return res.status(404).json({ message: 'Media not found' });
    }

    const media = result[0]; // Assuming the result is an array of objects

    // Assuming your server's public directory is set up to serve files from "public"
    const urlPath = new URL(media.url).pathname; // Extracts the path from the URL

    const localPath = path.join(
      __dirname,
      '../public/works',
      urlPath.substring(1)
    ); // Adjust as necessary to match your directory structure

    // Proceed with file deletion
    try {
      await fs.promises.unlink(localPath);
      await removeEmptyDirectories(path.dirname(localPath));
    } catch (fileError) {
      // Handle specific file system errors, e.g., file not found
      if (fileError.code === 'ENOENT') {
        console.log('No such file to delete, but continuing with DB deletion');
      } else {
        throw fileError; // Rethrow the error if it is not a 'file not found' error
      }
    }

    await conn.query('DELETE FROM media WHERE id = ?', [mediaId]);
    res.json({ message: 'Media deleted successfully' });
  } catch (error) {
    console.error('Failed to delete media:', error);
    res
      .status(500)
      .json({ error: 'Internal Server Error', details: error.message });
  } finally {
    if (conn) await conn.end();
  }
};

export async function deletePerson(req, res) {
  const { personId } = req.params;
  let conn;

  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Get the URLs of all files associated with the person's works
    const files = await conn.query(
      `SELECT media.url FROM media JOIN works ON works.id = media.work_id WHERE works.person_id = ?;`,
      [personId]
    );

    // Check if there are files to delete
    if (files.length > 0) {
      const deletePromises = files.map(async (file) => {
        try {
          // Resolve the file path from the URL
          const filePath = path.resolve(
            __dirname,
            '../public/works',
            new URL(file.url).pathname.substring(1)
          );

          // Attempt to delete the file
          await unlinkAsync(filePath);

          // Attempt to remove any empty directories after the file deletion
          await removeEmptyDirectories(path.dirname(filePath));
        } catch (err) {
          console.error(`Error processing file URL ${file.url}:`, err);
          return Promise.resolve(); // Resolve to avoid breaking Promise.all
        }
      });

      await Promise.all(deletePromises);
    } else {
      console.log('No files found for person, but continuing to delete person');
    }

    // Delete the person; assuming cascade deletes are setup to handle works/media
    const personDeleteResult = await conn.query(
      'DELETE FROM persons WHERE id = ?',
      [personId]
    );
    if (personDeleteResult.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ message: 'Person not found.' });
    }

    await conn.commit();
    res.json({
      message:
        'Person deleted successfully along with associated files (if any).',
    });
  } catch (error) {
    console.error(
      'An error occurred while deleting the person and files:',
      error
    );
    await conn.rollback();
    res.status(500).json({
      message: 'An error occurred while deleting the person and files.',
    });
  } finally {
    if (conn) {
      conn.release();
    }
  }
}
