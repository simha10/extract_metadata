import extract from "gpmf-extract";
import goproTelemetry from "gopro-telemetry";
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
    lat: Number(lastPoint.lat.toFixed(8)),
    lon: Number(lastPoint.lon.toFixed(8)),
    distance_m: 0
  });

  // Process remaining points
  for (const p of points.slice(1)) {
    const dist = haversine(lastPoint.lat, lastPoint.lon, p.lat, p.lon);
    if (dist >= minDist) {
      filtered.push({
        ...p,
        lat: Number(p.lat.toFixed(8)),
        lon: Number(p.lon.toFixed(8)),
        distance_m: Number(dist.toFixed(2))
      });
      lastPoint = p;
    }
  }

  return filtered;
}

/**
 * Parses raw binary GPMF telemetry into readable JSON
 * @param {Buffer} buffer - Raw telemetry data buffer
 * @returns {Promise<Array>} - Array of GPS data points
 */
export async function parseTelemetry(buffer) {
  try {
    logger.info("Parsing telemetry data");
    
    // Using gpmf-extract to get raw data and timing information
    const extracted = await extract(buffer);
    
    logger.info(`Extracted raw data size: ${extracted.rawData.length} bytes`);
    
    // Using gopro-telemetry to parse the data
    const telemetry = await new Promise((resolve, reject) => {
      goproTelemetry({
        rawData: extracted.rawData,
        timing: extracted.timing
      }, {
        stream: ['GPS5'] // Only extract GPS data
      }, (result) => {
        resolve(result);
      });
    });
    
    const gpsData = [];
    
    // Extract GPS data from the telemetry
    // The structure is: device_id.streams.GPS5.samples
    const deviceIds = Object.keys(telemetry || {});
    
    for (const deviceId of deviceIds) {
      const device = telemetry[deviceId];
      if (device.streams && device.streams.GPS5) {
        const gpsStream = device.streams.GPS5.samples;
        
        // Process ALL points (not just first 100)
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
    
    logger.info(`Parsed ${gpsData.length} GPS data points`);
    
    // Filter points by distance (50m minimum)
    const filteredData = filterByDistance(gpsData, 50);
    logger.info(`Filtered to ${filteredData.length} GPS points with 50m+ spacing`);
    
    return filteredData;
  } catch (err) {
    logger.warn(`Failed to parse telemetry data: ${err.message}`);
    // Return empty array to continue processing
    return [];
  }
}