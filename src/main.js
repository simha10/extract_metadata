import fs from "fs";
import path from "path";
import { extractTelemetry } from "./extractMetadata.js";
import { parseTelemetry } from "./parseTelemetry.js";
import { writeCSV } from "./csvWriter.js";
import { getVideoFiles, ensureDirectoryExists, getBaseName } from "./utils/fileHelper.js";
import logger from "./utils/logger.js";

const inputDir = "./input";
const outputDir = "./output_csv";

/**
 * Process all videos in the input directory
 */
async function processVideos() {
  try {
    // Ensure output directory exists
    ensureDirectoryExists(outputDir);
    
    // Get all video files from input directory
    const videoFiles = getVideoFiles(inputDir);
    
    logger.info(`Found ${videoFiles.length} videos to process`);
    
    if (videoFiles.length === 0) {
      logger.info("No video files found in input directory");
      return;
    }

    // Process each video file
    for (const videoPath of videoFiles) {
      const fileName = path.basename(videoPath);
      const baseName = getBaseName(fileName);
      const outputCsv = path.join(outputDir, `${baseName}.csv`);

      try {
        logger.info(`Processing ${fileName}...`);
        
        // Extract telemetry data
        const telemetryBuffer = await extractTelemetry(videoPath);
        logger.info(`Extracted telemetry buffer of size: ${telemetryBuffer.length} bytes`);
        
        // Parse telemetry data
        const parsedData = await parseTelemetry(telemetryBuffer);
        logger.info(`Parsed ${parsedData.length} data points`);
        
        // Write to CSV
        if (parsedData.length > 0) {
          await writeCSV(parsedData, outputCsv);
          logger.info(`✅ Output saved: ${outputCsv}`);
        } else {
          logger.warn(`⚠️ No telemetry data found in ${fileName}`);
        }
      } catch (err) {
        logger.error(`❌ Failed to process ${fileName}: ${err.message}`);
        logger.error(`Stack trace: ${err.stack}`);
      }
    }
    
    logger.info("Video processing completed");
  } catch (err) {
    logger.error(`Failed to process videos: ${err.message}`);
    logger.error(`Stack trace: ${err.stack}`);
    process.exit(1);
  }
}

// Run the processing
processVideos();