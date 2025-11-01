import fs from "fs";
import path from "path";

/**
 * Get all video files from the input directory
 * @param {string} inputDir - Path to the input directory
 * @returns {Array<string>} - Array of video file paths
 */
export function getVideoFiles(inputDir) {
  try {
    const files = fs.readdirSync(inputDir);
    return files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === ".mp4" || ext === ".mov" || ext === ".avi" || ext === ".mkv";
    }).map(file => path.join(inputDir, file));
  } catch (err) {
    throw new Error(`Failed to read input directory: ${err.message}`);
  }
}

/**
 * Ensure directory exists
 * @param {string} dirPath - Path to directory
 */
export function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Get base name without extension
 * @param {string} filePath - Path to file
 * @returns {string} - Base name without extension
 */
export function getBaseName(filePath) {
  return path.parse(filePath).name;
}