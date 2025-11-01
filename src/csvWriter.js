import { createObjectCsvWriter } from "csv-writer";
import logger from "./utils/logger.js";

/**
 * Converts telemetry JSON → CSV
 * @param {Array} data - Array of telemetry data points
 * @param {string} outputPath - Path to output CSV file
 */
export async function writeCSV(data, outputPath) {
  try {
    logger.info(`Writing ${data.length} records to ${outputPath}`);
    
    const writer = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: "videoName", title: "Video_Name" },
        { id: "lat", title: "Latitude" },
        { id: "lon", title: "Longitude" },
        { id: "alt", title: "Altitude (m)" },
        { id: "speed", title: "Speed (m/s)" },
        { id: "distance_m", title: "DistanceFromPrevious (m)" }
      ]
    });

    await writer.writeRecords(data);
    logger.info(`Successfully wrote CSV file: ${outputPath}`);
  } catch (err) {
    throw new Error(`Failed to write CSV file: ${err.message}`);
  }
}

/**
 * Converts telemetry JSON → CSV with consolidated data from multiple videos
 * @param {Array} allData - Array of all telemetry data points from all videos
 * @param {string} outputPath - Path to output CSV file
 */
export async function writeConsolidatedCSV(allData, outputPath) {
  try {
    logger.info(`Writing ${allData.length} records to consolidated CSV: ${outputPath}`);
    
    const writer = createObjectCsvWriter({
      path: outputPath,
      header: [
        { id: "videoName", title: "Video_Name" },
        { id: "lat", title: "Latitude" },
        { id: "lon", title: "Longitude" },
        { id: "alt", title: "Altitude (m)" },
        { id: "speed", title: "Speed (m/s)" },
        { id: "distance_m", title: "DistanceFromPrevious (m)" }
      ]
    });

    await writer.writeRecords(allData);
    logger.info(`Successfully wrote consolidated CSV file: ${outputPath}`);
  } catch (err) {
    throw new Error(`Failed to write consolidated CSV file: ${err.message}`);
  }
}