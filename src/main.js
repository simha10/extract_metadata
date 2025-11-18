import fs from "fs";
import path from "path";
import readline from "readline";
import extract from "gpmf-extract";
import goproTelemetry from "gopro-telemetry";
import { writeConsolidatedCSV } from "./csvWriter.js";
import { getVideoFiles, ensureDirectoryExists } from "./utils/fileHelper.js";
import { parseArguments, showHelp, validateInputDirectory } from "./utils/cliHelper.js";
import logger from "./utils/logger.js";

/**
 * Calculates distance between two GPS points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000; // meters
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Process GPS points into exactly 20m segments (except possibly the last segment)
 * @param {Array} points - Array of GPS points
 * @param {string} videoName - Name of the video
 * @returns {Array} Array of segments with start and end points
 */
function createSegments(points, videoName) {
  if (points.length < 2) return [];
  
  const segments = [];
  let accumulatedDistance = 0;
  let segmentStartIndex = 0;
  
  // Process points to create 20m segments
  for (let i = 1; i < points.length; i++) {
    const distanceFromStart = haversine(
      points[segmentStartIndex].lat, 
      points[segmentStartIndex].lon, 
      points[i].lat, 
      points[i].lon
    );
    
    // If we've accumulated at least 20m or it's the last point, create a segment
    if (distanceFromStart >= 20 || i === points.length - 1) {
      segments.push({
        videoName: videoName,
        startLat: Number(points[segmentStartIndex].lat.toFixed(8)),
        startLon: Number(points[segmentStartIndex].lon.toFixed(8)),
        endLat: Number(points[i].lat.toFixed(8)),
        endLon: Number(points[i].lon.toFixed(8)),
        alt: points[i].alt,
        speed: points[i].speed,
        distance_m: segmentStartIndex === 0 ? 0 : Number(distanceFromStart.toFixed(2))
      });
      
      // Set the current point as the start of the next segment
      segmentStartIndex = i;
    }
  }
  
  return segments;
}

/**
 * Process a single video file and return the telemetry data in 20m segments
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<Array>} Array of telemetry segments with video name
 */
async function processVideo(videoPath) {
  try {
    const videoName = path.basename(videoPath);
    logger.info(`Processing ${videoName}...`);
    
    // Check if file exists and is accessible
    if (!fs.existsSync(videoPath)) {
      throw new Error("File does not exist or is not accessible");
    }
    
    // Extract telemetry data directly with gpmf-extract
    logger.info("Extracting GPMF data...");
    
    // Check file size to handle large files appropriately
    const stats = fs.statSync(videoPath);
    const fileSizeInMB = stats.size / (1024 * 1024);
    logger.info(`File size: ${fileSizeInMB.toFixed(2)} MB`);
    
    // For very large files (>500MB), add a warning
    if (fileSizeInMB > 500) {
      logger.warn(`Large file detected (${fileSizeInMB.toFixed(2)} MB). Processing may take longer.`);
    }
    
    // Read file with error handling
    let buffer;
    try {
      buffer = fs.readFileSync(videoPath);
    } catch (readErr) {
      throw new Error(`Failed to read file: ${readErr.message}`);
    }
    
    // Validate buffer
    if (!buffer || buffer.length === 0) {
      throw new Error("File is empty or could not be read properly");
    }
    
    logger.info(`Read ${buffer.length} bytes from file`);
    
    // Extract with timeout protection for large files
    const extracted = await Promise.race([
      extract(buffer),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Extraction timeout - file may be too large or corrupted")), 120000)
      )
    ]);
    
    logger.info(`Extracted raw data size: ${extracted.rawData.length} bytes`);
    
    // Validate extracted data
    if (!extracted.rawData || extracted.rawData.length === 0) {
      throw new Error("No telemetry data extracted from file");
    }
    
    // Parse telemetry data with timeout
    logger.info("Parsing telemetry data...");
    const telemetry = await Promise.race([
      new Promise((resolve) => {
        goproTelemetry({
          rawData: extracted.rawData,
          timing: extracted.timing
        }, {
          stream: ['GPS5'],
          groupTimes: 1000
        }, (result) => {
          logger.info("Telemetry parsing completed");
          resolve(result);
        });
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Telemetry parsing timeout")), 60000)
      )
    ]);
    
    // Extract GPS data
    const gpsData = [];
    const deviceIds = Object.keys(telemetry || {});

    logger.info(`Found ${deviceIds.length} telemetry devices`);

    for (const deviceId of deviceIds) {
      const device = telemetry[deviceId];
      if (device && device.streams && device.streams.GPS5) {
        const gpsStream = device.streams.GPS5.samples;
        
        logger.info(`Processing ${gpsStream.length} GPS samples from device ${deviceId}`);
        
        gpsStream.forEach((sample) => {
          // Sample structure: { cts, date, value }
          // value is [lat, lon, alt, speed, speedVert]
          if (sample && sample.value && sample.value.length >= 4) {
            gpsData.push({
              time: sample.cts || (sample.date ? sample.date.getTime() : Date.now()),
              lat: sample.value[0],
              lon: sample.value[1],
              alt: sample.value[2],
              speed: sample.value[3]
            });
          }
        });
      }
    }
    
    logger.info(`Extracted ${gpsData.length} GPS data points`);
    
    // Clean up memory
    buffer = null;
    extracted.rawData = null;
    extracted.timing = null;
    
    if (gpsData.length > 0) {
      // Create segments directly from the raw data (without pre-filtering)
      const segments = createSegments(gpsData, videoName);
      logger.info(`Created ${segments.length} segments for ${videoName}`);
      
      // Clean up memory
      gpsData.length = 0;
      
      return segments;
    } else {
      logger.warn(`⚠️ No telemetry data found in ${videoName}`);
      return [];
    }
  } catch (err) {
    logger.error(`❌ Failed to process ${videoPath}: ${err.message}`);
    // Return empty array instead of throwing to prevent complete failure
    return [];
  }
}

/**
 * Process all videos in the input directory and create a consolidated CSV
 * @param {string} inputDir - Input directory path
 * @param {string} outputDir - Output directory path
 */
async function processAllVideos(inputDir, outputDir = "./output_csv") {
  // Validate input directory
  if (!validateInputDirectory(inputDir)) {
    process.exit(1);
  }
  
  // Get all video files from input directory
  let videoFiles;
  try {
    videoFiles = fs.readdirSync(inputDir).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ext === ".mp4" || ext === ".mov" || ext === ".avi" || ext === ".mkv";
    });
  } catch (err) {
    logger.error(`Failed to read directory ${inputDir}: ${err.message}`);
    process.exit(1);
  }

  if (videoFiles.length === 0) {
    logger.info("No video files found in input directory");
    return;
  }

  logger.info(`Found ${videoFiles.length} videos to process`);
  
  // Warn if there are many files
  if (videoFiles.length > 100) {
    logger.warn(`Large batch detected (${videoFiles.length} files). This may take a while and consume significant system resources.`);
    logger.warn("Consider processing in smaller batches if you experience performance issues.");
  }
  
  // Ensure output directory exists
  try {
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
  } catch (err) {
    logger.error(`Failed to create output directory ${outputDir}: ${err.message}`);
    process.exit(1);
  }
  
  // Collect all segments from all videos
  const allSegments = [];
  let successCount = 0;
  
  // Track processing time for ETA calculation
  const startTime = Date.now();
  let processedCount = 0;
  
  // Process each video file
  for (const videoFile of videoFiles) {
    const videoPath = path.join(inputDir, videoFile);
    try {
      // Calculate and display progress
      processedCount++;
      const elapsedTime = Date.now() - startTime;
      const avgTimePerFile = elapsedTime / processedCount;
      const remainingFiles = videoFiles.length - processedCount;
      const etaMs = avgTimePerFile * remainingFiles;
      const etaMinutes = Math.ceil(etaMs / 60000);
      
      logger.info(`Progress: ${processedCount}/${videoFiles.length} files processed (${Math.round((processedCount/videoFiles.length)*100)}%)`);
      if (processedCount > 1) {  // Only show ETA after processing at least one file
        logger.info(`Estimated time remaining: ${etaMinutes} minute${etaMinutes !== 1 ? 's' : ''}`);
      }
      
      const videoSegments = await processVideo(videoPath);
      if (videoSegments.length > 0) {
        allSegments.push(...videoSegments);
        successCount++;
      }
      
      // Memory management for large batches
      if (processedCount % 50 === 0) {
        // Force garbage collection if available (Node.js flag --expose-gc)
        if (global.gc) {
          global.gc();
          logger.info("Performed garbage collection to free memory");
        }
      }
      
      // Continue processing even if one video fails
    } catch (err) {
      logger.error(`Failed to process ${videoFile}: ${err.message}`);
      // Continue with next video instead of stopping
    }
  }
  
  // Create consolidated CSV file
  if (allSegments.length > 0) {
    try {
      // Use the input directory name for the output file
      const inputDirName = path.basename(inputDir);
      const outputCsv = path.join(outputDir, `${inputDirName}_segments_data.csv`);
      
      logger.info("Writing consolidated CSV with segments...");
      await writeConsolidatedCSV(allSegments, outputCsv);
      logger.info(`✅ Successfully wrote consolidated CSV with ${allSegments.length} segments to ${outputCsv}`);
    } catch (err) {
      logger.error(`Failed to write consolidated CSV: ${err.message}`);
    }
  } else {
    logger.warn("No telemetry data found in any videos. CSV file not created.");
  }
  
  const totalTimeMinutes = Math.round((Date.now() - startTime) / 60000);
  logger.info(`🏁 Processing complete! Successfully processed ${successCount} out of ${videoFiles.length} videos in ${totalTimeMinutes} minute${totalTimeMinutes !== 1 ? 's' : ''}.`);
}

/**
 * Prompt user for input directory path
 * @returns {Promise<string>} Input directory path
 */
function promptForInputPath() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question("Enter the path to the folder containing your videos: ", (inputPath) => {
      rl.close();
      resolve(inputPath.trim());
    });
  });
}

// Parse command line arguments
let options;
try {
  options = parseArguments();
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

// Show help if requested
if (options.help) {
  showHelp();
  process.exit(0);
}

// If no input directory was provided via command line, prompt the user
let inputDir = options.inputDir;
if (process.argv.length <= 2 || (process.argv.length === 3 && (process.argv[2] === "--output" || process.argv[2] === "-o"))) {
  // Only prompt if no significant arguments were provided
  const hasOtherArgs = process.argv.slice(2).some(arg => 
    arg !== "--input" && arg !== "-i" && arg !== "--output" && arg !== "-o" && !arg.startsWith("--")
  );
  
  if (!hasOtherArgs) {
    inputDir = await promptForInputPath();
  }
}

// Run the processing
processAllVideos(inputDir, options.outputDir);