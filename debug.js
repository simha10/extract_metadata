import fs from "fs";
import extract from "gpmf-extract";
import goproTelemetry from "gopro-telemetry";

console.log("Reading video file...");
const buffer = fs.readFileSync("./input/GH010079.MP4");

console.log("Extracting GPMF data...");
extract(buffer).then(extracted => {
  console.log("GPMF extraction completed");
  console.log("Raw data length:", extracted.rawData.length);
  console.log("Timing:", extracted.timing);
  
  console.log("Parsing telemetry data...");
  goproTelemetry({
    rawData: extracted.rawData,
    timing: extracted.timing
  }, {
    stream: ['GPS5'],
    groupTimes: 1000
  }, (telemetry) => {
    console.log("Telemetry parsing completed");
    console.log("Telemetry keys:", Object.keys(telemetry));
    
    // Check for GPS data
    const deviceIds = Object.keys(telemetry || {});
    let totalPoints = 0;
    for (const deviceId of deviceIds) {
      const device = telemetry[deviceId];
      if (device.streams && device.streams.GPS5) {
        console.log(`Device ${deviceId} GPS5 samples:`, device.streams.GPS5.samples.length);
        totalPoints += device.streams.GPS5.samples.length;
      }
    }
    console.log("Total GPS points:", totalPoints);
  });
}).catch(err => {
  console.error("Error:", err);
});