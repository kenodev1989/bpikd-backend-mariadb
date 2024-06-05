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
    const backupDir = path.join(process.cwd(), 'public', 'backup');
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

  output.on('close', () =>
    console.log(`Backup created: ${archive.pointer()} total bytes`)
  );
  output.on('end', () => console.log('Data has been drained'));

  archive.on('warning', (err) => {
    if (err.code === 'ENOENT') {
      console.warn(err);
    } else {
      throw err;
    }
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);
  // Patterns to match files/folders to be included or excluded
  archive.glob('**/*', {
    cwd: rootDir,
    ignore: ['node_modules/**', '.env', 'backups/**'], // Exclude specified paths
  });

  await archive.finalize();

  return backupPath;
};

// Assume the zipped file is stored in a 'public' or 'backups' directory
const zipPath = path.join(__dirname, 'backups');

router.get('/react-build', async (req, res) => {
  try {
    res.download(zipPath, 'react_build.zip', (err) => {
      if (err) {
        res.status(500).send('Failed to download the file.');
      }
    });
  } catch (error) {
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
