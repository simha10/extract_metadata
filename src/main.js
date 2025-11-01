import fs from "fs";
import path from "path";
import readline from "readline";
import extract from "gpmf-extract";
import goproTelemetry from "gopro-telemetry";
import { writeCSV } from "./csvWriter.js";
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
 * Filters GPS points to include only those with sufficient distance between them
 * Ensures at least start and end points are included
 * @param {Array} points - Array of GPS points
 * @param {number} minDist - Minimum distance in meters (default: 50)
 * @returns {Array} Filtered array of GPS points with distance tracking
 */
function filterByDistance(points, minDist = 50) {
  if (points.length === 0) return [];
  
  const filtered = [];
  let lastPoint = points[0];
  
  // Always include the first point (start point)
  filtered.push({
    ...lastPoint,
    lat: Number(lastPoint.lat.toFixed(8)),
    lon: Number(lastPoint.lon.toFixed(8)),
    distance_m: 0
  });

  // Process remaining points
  let lastAddedPoint = lastPoint;
  for (const p of points.slice(1)) {
    const dist = haversine(lastAddedPoint.lat, lastAddedPoint.lon, p.lat, p.lon);
    if (dist >= minDist) {
      filtered.push({
        ...p,
        lat: Number(p.lat.toFixed(8)),
        lon: Number(p.lon.toFixed(8)),
        distance_m: Number(dist.toFixed(2))
      });
      lastAddedPoint = p;
    }
  }

  // Ensure the last point (end point) is always included if not already added
  const lastPointInData = points[points.length - 1];
  if (filtered.length === 1 || 
      (lastPointInData.lat !== lastAddedPoint.lat || 
       lastPointInData.lon !== lastAddedPoint.lon)) {
    // Calculate distance from last added point to last point
    const distFromLast = haversine(
      lastAddedPoint.lat, 
      lastAddedPoint.lon, 
      lastPointInData.lat, 
      lastPointInData.lon
    );
    
    filtered.push({
      ...lastPointInData,
      lat: Number(lastPointInData.lat.toFixed(8)),
      lon: Number(lastPointInData.lon.toFixed(8)),
      distance_m: Number(distFromLast.toFixed(2))
    });
  }

  return filtered;
}

/**
 * Process a single video file
 * @param {string} videoPath - Path to the video file
 * @param {string} outputDir - Output directory for CSV files
 * @returns {Promise<boolean>} Success status
 */
async function processVideo(videoPath, outputDir = "./output_csv") {
  try {
    const videoName = path.basename(videoPath);
    const baseName = path.parse(videoName).name;

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputCsv = path.join(outputDir, `${baseName}_real_data.csv`);

    logger.info(`Processing ${videoName}...`);
    
    // Extract telemetry data directly with gpmf-extract
    logger.info("Extracting GPMF data...");
    const buffer = fs.readFileSync(videoPath);
    const extracted = await extract(buffer);
    logger.info(`Extracted raw data size: ${extracted.rawData.length} bytes`);
    
    // Parse telemetry data
    logger.info("Parsing telemetry data...");
    const telemetry = await new Promise((resolve) => {
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
    });
    
    // Extract GPS data
    const gpsData = [];
    const deviceIds = Object.keys(telemetry || {});

    logger.info(`Found ${deviceIds.length} telemetry devices`);

    for (const deviceId of deviceIds) {
      const device = telemetry[deviceId];
      if (device.streams && device.streams.GPS5) {
        const gpsStream = device.streams.GPS5.samples;
        
        logger.info(`Processing ${gpsStream.length} GPS samples from device ${deviceId}`);
        
        gpsStream.forEach((sample) => {
          // Sample structure: { cts, date, value }
          // value is [lat, lon, alt, speed, speedVert]
          if (sample.value && sample.value.length >= 4) {
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
    
    if (gpsData.length > 0) {
      // Apply distance filtering
      logger.info("Applying distance filtering...");
      const filteredData = filterByDistance(gpsData, 50);
      logger.info(`Filtered to ${filteredData.length} GPS points with 50m+ spacing`);
      
      // Write to CSV
      logger.info("Writing to CSV...");
      await writeCSV(filteredData, outputCsv);
      logger.info(`✅ Successfully wrote real GPS data to ${outputCsv}`);
      
      return true;
    } else {
      logger.warn(`⚠️ No telemetry data found in ${videoName}`);
      return false;
    }
  } catch (err) {
    logger.error(`❌ Failed to process ${videoPath}: ${err.message}`);
    return false;
  }
}

/**
 * Process all videos in the input directory
 * @param {string} inputDir - Input directory path
 * @param {string} outputDir - Output directory path
 */
async function processAllVideos(inputDir, outputDir = "./output_csv") {
  // Validate input directory
  if (!validateInputDirectory(inputDir)) {
    process.exit(1);
  }
  
  // Get all video files from input directory
  const videoFiles = fs.readdirSync(inputDir).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return ext === ".mp4" || ext === ".mov" || ext === ".avi" || ext === ".mkv";
  });

  if (videoFiles.length === 0) {
    logger.info("No video files found in input directory");
    return;
  }

  logger.info(`Found ${videoFiles.length} videos to process`);
  
  let successCount = 0;
  
  // Process each video file
  for (const videoFile of videoFiles) {
    const videoPath = path.join(inputDir, videoFile);
    try {
      const success = await processVideo(videoPath, outputDir);
      if (success) {
        successCount++;
      }
    } catch (err) {
      logger.error(`Failed to process ${videoFile}: ${err.message}`);
    }
  }
  
  logger.info(`🏁 Processing complete! Successfully processed ${successCount} out of ${videoFiles.length} videos.`);
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