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
        { id: "time", title: "Timestamp" },
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