import express from 'express';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { finished } from 'stream';
import pool from '../db/config.js';
const streamFinished = promisify(finished);
import archiver from 'archiver';
const router = express.Router();

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backupDatabase = async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    const tables = await conn.query('SHOW TABLES');
    const rootDir = path.join(__dirname, '../'); // Adjust according to where your script is located
    const backupDir = path.join(rootDir, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = path.join(
      backupDir,
      `backup-${new Date().toISOString().slice(0, 10)}.sql`
    );
    const stream = fs.createWriteStream(backupPath, { encoding: 'utf-8' });

    for (const tableInfo of tables) {
      const tableName = Object.values(tableInfo)[0];
      const data = await conn.query(`SELECT * FROM ${tableName}`);
      if (data.length > 0) {
        const keys = Object.keys(data[0]);
        stream.write(`-- Data for table ${tableName}\n`);
        data.forEach((row) => {
          const values = keys
            .map((key) => `'${row[key]?.toString().replace(/'/g, "''")}'`)
            .join(', ');
          stream.write(
            `INSERT INTO ${tableName} (${keys.join(
              ', '
            )}) VALUES (${values});\n`
          );
        });
      } else {
        stream.write(`-- No data available for table ${tableName}\n`);
      }
    }

    stream.end();
    await streamFinished(stream);
    console.log('Backup completed successfully.');
    return backupPath; // Return the path to the created backup file
  } catch (err) {
    console.error('Error during database backup:', err);
    throw err; // Throw error to be handled by route
  } finally {
    if (conn) {
      await conn.end();
    }
  }
};

const backupBackend = async () => {
  const rootDir = path.join(__dirname, '../'); // Adjust according to where your script is located
  const backupsDir = path.join(rootDir, 'backups');

  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const backupFileName = `backup-${new Date().toISOString().slice(0, 10)}.zip`;
  const backupPath = path.join(backupsDir, backupFileName);
  const output = fs.createWriteStream(backupPath);
  const archive = archiver('zip', {
    zlib: { level: 9 }, // Sets the compression level.
  });

  // Listen for all archive data to be written
  output.on('close', () => {
    console.log(`Backup created: ${archive.pointer()} total bytes`);
  });

  // Good practice to catch warnings (ie stat failures and other non-blocking errors)
  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn(`File not found: ${err}`);
    } else {
      console.error(`Archiver warning: ${err}`);
    }
  });

  // Catch this error explicitly
  archive.on('error', (err) => {
    console.error(`Archiver error: ${err}`);
    throw err;
  });

  // Pipe archive data to the file
  archive.pipe(output);

  // Append files from a glob pattern
  archive.glob('**/*', {
    cwd: rootDir,
    ignore: ['node_modules/**', 'backups/**'], // Exclude specified paths
  });

  // Finalize the archive (ie we are done appending files but streams have to finish yet)
  await archive
    .finalize()
    .then(() => {
      console.log('Archive finalized');
    })
    .catch((err) => {
      console.error(`Error finalizing archive: ${err}`);
      throw err;
    });

  return backupPath;
};

// Adjust the path according to where your script is located
const rootDir = path.join(__dirname, '../');
// Ensure this points directly to the file you intend to send, not a directory
const backupFilePath = path.join(rootDir, 'backups', 'react_build.zip');

router.get('/react-build', async (req, res) => {
  // Setting no timeout for a download might be necessary if it's a large file
  req.setTimeout(0); // Be cautious with setting no timeout in a production environment

  console.log('Attempting to send file:', backupFilePath);
  try {
    res.download(backupFilePath, 'react_build.zip', (err) => {
      if (err) {
        // Log the error for server-side debugging
        console.error('Download error:', err);
        // Send a more detailed error response or keep it generic based on your error handling policy
        res.status(500).send('Failed to download the file.');
      }
    });
  } catch (error) {
    console.error('Error encountered:', error);
    res.status(500).send('Error preparing the download.');
  }
});

router.get('/backend', async (req, res) => {
  req.setTimeout(0); // No timeout
  try {
    const backupPath = await backupBackend();
    res.download(backupPath, (error) => {
      if (error) {
        console.error('Download failed:', error);
        res.status(500).send('Failed to download backup');
      }
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    res.status(500).send('Failed to create backup');
  }
});

router.get('/db-backup', async (req, res) => {
  try {
    const backupPath = await backupDatabase(); // Ensure the backup function returns the file path
    res.download(backupPath); // This sends the file to the client
  } catch (error) {
    console.error('Error during database backup:', error);
    res.status(500).send('Failed to create database backup');
  }
});

export default router;
