import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { query } from './db/config.js'; // Your DB configuration using ES6 imports

const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);

/**
 * Cleans up orphaned files in a given directory based on a set of valid filenames.
 * @param {string} directoryPath - The path to the directory where files are stored.
 * @param {Set} validFiles - A set containing all valid filenames that should not be deleted.
 */
export async function cleanUpOrphanedFiles(directoryPath, validFiles) {
  try {
    const filesInDirectory = await readdir(directoryPath);
    const cleanupPromises = filesInDirectory.map((file) => {
      if (!validFiles.has(file)) {
        const filePath = path.join(directoryPath, file);
        console.log(`Deleting orphaned file: ${filePath}`);
        return unlink(filePath);
      }
    });
    await Promise.all(cleanupPromises);
    console.log('Cleanup complete. Orphaned files removed.');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

async function handleUploadsAndCleanup() {
  // Example of fetching valid filenames from a database
  const [results] = await query('SELECT src FROM footer_companies');
  const validFiles = new Set(
    results.map((result) => path.basename(result.src))
  );

  // Call the cleanup function with the directory path and valid filenames
  await cleanUpOrphanedFiles('./public/uploads/footer', validFiles);
}

// Run the function to handle uploads and perform cleanup
handleUploadsAndCleanup();

async function performAllCleanups() {
  const footerFiles = await getValidFilesFromDB('footer_companies');
  const profileFiles = await getValidFilesFromDB('profile_companies');

  await cleanUpOrphanedFiles('./public/uploads/footer', footerFiles);
  await cleanUpOrphanedFiles('./public/uploads/profiles', profileFiles);
  // Add more directories as needed
}

async function getValidFilesFromDB(tableName) {
  const [results] = await query(`SELECT src FROM ${tableName}`);
  return new Set(results.map((result) => path.basename(result.src)));
}

performAllCleanups();
