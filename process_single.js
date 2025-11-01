import fs from "fs";
import path from "path";
import extract from "gpmf-extract";
import goproTelemetry from "gopro-telemetry";
import { writeCSV } from "./src/csvWriter.js";
import logger from "./src/utils/logger.js";
import { getBaseName } from "./src/utils/fileHelper.js";

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
 * @param {Array} points - Array of GPS points
 * @param {number} minDist - Minimum distance in meters (default: 50)
 * @returns {Array} Filtered array of GPS points with distance tracking
 */
function filterByDistance(points, minDist = 50) {
  if (points.length === 0) return [];
  
  const filtered = [];
  let lastPoint = points[0];
  
  // Always include the first point
  filtered.push({
    ...lastPoint,
    lat: Number(lastPoint.lat.toFixed(6)),
    lon: Number(lastPoint.lon.toFixed(6)),
    distance_m: 0
  });

  // Process remaining points
  for (const p of points.slice(1)) {
    const dist = haversine(lastPoint.lat, lastPoint.lon, p.lat, p.lon);
    if (dist >= minDist) {
      filtered.push({
        ...p,
        lat: Number(p.lat.toFixed(6)),
        lon: Number(p.lon.toFixed(6)),
        distance_m: Number(dist.toFixed(2))
      });
      lastPoint = p;
    }
  }

  return filtered;
}

async function processSingleVideo(videoName) {
  try {
    const inputDir = "./input";
    const outputDir = "./output_csv";
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const videoPath = path.join(inputDir, videoName);
    const baseName = getBaseName(videoName);
    const outputCsv = path.join(outputDir, `${baseName}_real_data.csv`);

    console.log(`Processing ${videoName}...`);
    
    // Extract telemetry data directly with gpmf-extract
    console.log("Extracting GPMF data...");
    const buffer = fs.readFileSync(videoPath);
    const extracted = await extract(buffer);
    console.log(`Extracted raw data size: ${extracted.rawData.length} bytes`);
    
    // Parse telemetry data
    console.log("Parsing telemetry data...");
    const telemetry = await new Promise((resolve) => {
      goproTelemetry({
        rawData: extracted.rawData,
        timing: extracted.timing
      }, {
        stream: ['GPS5'],
        groupTimes: 1000
      }, (result) => {
        console.log("Telemetry parsing completed");
        resolve(result);
      });
    });
    
    // Extract GPS data
    const gpsData = [];
    const deviceIds = Object.keys(telemetry || {});

    console.log(`Found ${deviceIds.length} telemetry devices`);

    for (const deviceId of deviceIds) {
      const device = telemetry[deviceId];
      if (device.streams && device.streams.GPS5) {
        const gpsStream = device.streams.GPS5.samples;
        
        console.log(`Processing ${gpsStream.length} GPS samples from device ${deviceId}`);
        
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
    
    console.log(`Extracted ${gpsData.length} GPS data points`);
    
    if (gpsData.length > 0) {
      console.log("First 3 GPS points:");
      for (let i = 0; i < Math.min(3, gpsData.length); i++) {
        console.log(`  ${i}: Time=${gpsData[i].time}, Lat=${gpsData[i].lat}, Lon=${gpsData[i].lon}`);
      }
      
      // Apply distance filtering
      console.log("Applying distance filtering...");
      const filteredData = filterByDistance(gpsData, 50);
      console.log(`Filtered to ${filteredData.length} GPS points with 50m+ spacing`);
      
      // Write to CSV
      console.log("Writing to CSV...");
      await writeCSV(filteredData, outputCsv);
      console.log(`✅ Successfully wrote real GPS data to ${outputCsv}`);
      
      // Show first few lines of the CSV
      console.log("\nFirst few lines of the CSV:");
      const csvContent = fs.readFileSync(outputCsv, 'utf8');
      const lines = csvContent.split('\n');
      for (let i = 0; i < Math.min(4, lines.length); i++) {
        console.log(lines[i]);
      }
      
      return true;
    } else {
      console.log(`⚠️ No telemetry data found in ${videoName}`);
      return false;
    }
  } catch (err) {
    console.error(`❌ Failed to process ${videoName}: ${err.message}`);
    console.error(`Stack trace: ${err.stack}`);
    return false;
  }
}

// Process the first video
const videoFiles = fs.readdirSync("./input").filter(file => {
  const ext = path.extname(file).toLowerCase();
  return ext === ".mp4" || ext === ".mov" || ext === ".avi" || ext === ".mkv";
});

if (videoFiles.length > 0) {
  console.log(`Found ${videoFiles.length} videos. Processing the first one: ${videoFiles[0]}`);
  processSingleVideo(videoFiles[0]).then(success => {
    if (success) {
      console.log("Processing completed successfully!");
    } else {
      console.log("Processing failed!");
    }
  });
} else {
  console.log("No video files found in input directory");
}