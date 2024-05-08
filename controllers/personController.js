import express from 'express';
import multer from 'multer';
import pool from '../db/config.js';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';
import util from 'util';
import bodyParser from 'body-parser';
import * as schedule from 'node-schedule';

import moment from 'moment-timezone';

const unlinkAsync = util.promisify(fs.unlink);
const accessAsync = util.promisify(fs.access);
const app = express();
app.use(bodyParser.urlencoded({ extended: true })); // o

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function serializeBigInt(key, value) {
  if (typeof value === 'bigint') {
    return value.toString(); // convert BigInt to string
  } else {
    return value; // return everything else unchanged
  }
}

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
        ? `${req.protocol}://${req.get('host')}/uploads/${
            req.files.featuredImage[0].filename
          }`
        : null;

    // Improved debug statement to clarify what's retrieved
    /* const [existing] = await conn.query(
      "SELECT id FROM persons WHERE firstName = ? AND lastName = ?",
      [personData.firstName, personData.lastName]
    );
    console.log("Existing person check:", existing); */

    const [existing] = await conn.query(
      'SELECT id FROM persons WHERE id = ? AND firstName = ? AND lastName = ?',
      [personData.id, personData.firstName, personData.lastName]
    );

    let personId = existing ? existing.id : null;
    /* let personId = existing && existing.length > 0 ? existing.id : null; */
    console.log('Determined person ID:', existing); // Additional debug information

    if (personId) {
      console.log('Using existing person ID:', personId); // This should appear if a person is found
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
      console.log('New person inserted with ID:', personId); // Log new person ID
    }

    const scheduledTimeUTC = moment
      .tz(scheduledPublishTime, 'Europe/Berlin')
      .utc()
      .toDate();

    // Current time in UTC as a Date object
    const currentTimeUTC = new Date();

    console.log(`Scheduled Time UTC: ${scheduledTimeUTC}`);
    console.log(`Current Time UTC: ${currentTimeUTC}`);

    const validScheduledTime = scheduledTimeUTC > currentTimeUTC;
    console.log(`Is the scheduled time in the future? ${validScheduledTime}`);
    console.log(`Is valid future time? ${validScheduledTime}`);

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

    console.log('Work added with ID:', workId);

    let media = { images: [], videos: [], audios: [], documents: [] };
    ['images', 'videos', 'audios', 'documents'].forEach((type) => {
      if (req.files && req.files[type]) {
        req.files[type].forEach((file) => {
          const filePath = `${req.protocol}://${req.get('host')}/uploads/${
            file.filename
          }`;
          media[type].push({
            url: filePath,
            name: file.originalname,
            fileType: file.mimetype,
            type,
          });
          // Insert each media file into the database
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

/* export const searchPersonsByPartialName = async (req, res) => {
  const { searchQuery } = req.query;

  let conn;
  try {
    conn = await pool.getConnection();
    const query = `
      SELECT id, firstName, lastName, featured
      FROM persons
      WHERE firstName LIKE CONCAT('%', ?, '%') OR lastName LIKE CONCAT('%', ?, '%');
    `;

    const results = await conn.query(query, [searchQuery, searchQuery]);

    if (!results) {
      res.status(404).json({ message: 'No users found.' });
      return;
    }

    // Ensure that results is an array before trying to map over it
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
}; */

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

export async function deletePerson(req, res) {
  let conn;
  try {
    const { personId } = req.params;

    conn = await pool.getConnection();

    // Delete the person; dependent records will be deleted by the database
    const result = await conn.query('DELETE FROM persons WHERE id = ?', [
      personId,
    ]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Person not found.' });
    }

    res.json({ message: 'Person deleted successfully.' });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: 'An error occurred while deleting the person.' });
  } finally {
    if (conn) {
      conn.release();
    }
  }
}

export const deleteMultiplePersons = async (req, res) => {
  const { personIds } = req.body; // Expect an array of person IDs
  console.log('Received person IDs for deletion:', personIds);

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
      ? `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`
      : featured;

    console.log(featuredImage);

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
    cb(null, './public/uploads/'); // Directory where files are saved
  },
  filename: function (req, file, cb) {
    const extension = file.originalname.split('.').pop();
    const personId = req.params.personId; // Assuming personId is in the route parameters
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
                aboutPerson
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
  ORDER BY w.id;
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

export const getPersonWithWorksAndMediaById = async (req, res) => {
  const { personId } = req.params; // assuming person ID is sent as a URL parameter

  let conn;
  try {
    conn = await pool.getConnection();

    // Query to fetch person details, works, and associated media
    const query = `
            SELECT p.id AS personId, p.firstName, p.lastName, p.aboutPerson, p.featured,
                   w.id AS workId, w.title, w.content, w.publishTime, w.isPublished, w.scheduledPublishTime, w.externalSource,
                   m.id AS mediaId, m.url, m.name AS mediaName, m.fileType, m.type
            FROM persons p
            LEFT JOIN works w ON p.id = w.person_id
            LEFT JOIN media m ON w.id = m.work_id
            WHERE p.id = ?
            ORDER BY w.id, m.id;
        `;

    const rows = await conn.query(query, [personId]);

    // Formatting the response to include media sorted by type under each work
    let response = {
      personId: personId,
      firstName: rows[0]?.firstName,
      lastName: rows[0]?.lastName,
      aboutPerson: rows[0]?.aboutPerson,
      featured: rows[0]?.featured,
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
          scheduledPublishTime: row.scheduledPublishTime,
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
      SELECT w.id, w.title, w.content, w.person_id, w.publishTime, w.isPublished, w.scheduledPublishTime, w.externalSource,
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

/* const mediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const type = file.mimetype.split('/')[0]; // 'image', 'audio', etc.
    console.log(type);
    let folderName = '';
    switch (type) {
      case 'image':
        folderName = 'images';
        break;
      case 'audio':
        folderName = 'audios';
        break;
      case 'video':
        folderName = 'videos';
        break;
      case 'application':
        folderName = 'documents'; // Example handling for document types
        break;
      default:
        folderName = 'others'; // Handling any other file types
        break;
    }
    cb(null, path.join(__dirname, `../public/uploads/${folderName}`));
  },
  filename: function (req, file, cb) {
    const index = req.body.index; // Make sure 'index' is being sent correctly
    const extension = path.extname(file.originalname);
    cb(null, `${req.params.workId}-${file.fieldname}-${index}${extension}`);
  },
}); */

/* const mediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const type = file.mimetype.split('/')[0]; // 'image', 'audio', etc.
    let folderName = '';
    if (type === 'image') folderName = 'images';
    else if (type === 'audio') folderName = 'audios';
    else if (type === 'video') folderName = 'videos';
    else folderName = 'documents'; // This handles documents and other file types
    cb(null, path.join(__dirname, `../public/uploads/${folderName}`));
  },
  filename: function (req, file, cb) {
    const index = req.body.index; // Ensure index is passed as part of the form data
    const extension = path.extname(file.originalname);
    const workId = req.params.workId;
    cb(null, `${workId}-${file.fieldname}-${index}${extension}`);
  },
}); */

const mediaStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const fileType = file.mimetype.split('/')[0];
    const folderMap = {
      image: 'images',
      video: 'videos',
      audio: 'audios',
      application: 'documents', // You may need to tailor this more specifically
    };
    const folderName = folderMap[fileType] || 'others';
    cb(null, path.join(__dirname, `../public/uploads/${folderName}`));
  },
  filename: function (req, file, cb) {
    const workId = req.params.workId;
    const extension = path.extname(file.originalname);
    cb(null, `${workId}-${file.fieldname}-${Date.now()}${extension}`);
  },
});

export const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 10000000000000 }, // 1MB for example
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
}).fields([
  { name: 'images', maxCount: 20 },
  { name: 'videos', maxCount: 20 },
  { name: 'audios', maxCount: 20 },
  { name: 'documents', maxCount: 20 },
]);

// Check file type
function checkFileType(file, cb) {
  // Allowed ext
  const filetypes = /jpeg|jpg|png|gif|mp4|avi|mpeg|mp3|wav|pdf|doc|docx/;
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

  console.log(req.body);

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

// DELETE media by mediaId
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
    const filePath = path.join(
      __dirname,
      '..',
      'public',
      media.url.substring(media.url.indexOf('/uploads'))
    );

    // Proceed with file deletion
    try {
      await fs.promises.unlink(filePath);
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
