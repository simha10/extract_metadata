import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import logger from "./utils/logger.js";

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

const unlinkAsync = promisify(fs.unlink);

/**
 * Extracts telemetry stream using FFmpeg
 * @param {string} videoPath - Path to the video file
 * @returns {Promise<Buffer>} - Raw telemetry data buffer
 */
export async function extractTelemetry(videoPath) {
  const outputBin = videoPath.replace(path.extname(videoPath), ".bin");
  
  logger.info(`Extracting telemetry from ${videoPath}`);

  // First, let's try to get stream information
  const streamInfo = await new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .ffprobe((err, metadata) => {
        if (err) {
          reject(new Error(`Failed to probe video: ${err.message}`));
        } else {
          resolve(metadata);
        }
      });
  });

  // Log stream information for debugging
  logger.info(`Video streams: ${JSON.stringify(streamInfo.streams.map(s => s.codec_type + " " + (s.tags?.handler_name || "")))}`);

  // Check if there's a GoPro MET stream
  const goproStream = streamInfo.streams.find(stream => 
    stream.codec_type === 'data' && 
    (stream.tags?.handler_name?.includes('GoPro MET') || stream.tags?.handler_name?.includes('GPMD'))
  );

  if (!goproStream) {
    // Try to find any data stream that might contain telemetry
    const dataStreams = streamInfo.streams.filter(stream => stream.codec_type === 'data');
    if (dataStreams.length === 0) {
      throw new Error("No data streams found in video. This video may not contain embedded telemetry.");
    }
    logger.warn("No GoPro MET stream found, trying first data stream");
  }

  return new Promise((resolve, reject) => {
    const command = ffmpeg(videoPath)
      .outputOptions([
        "-codec copy"
      ]);

    // If we found a GoPro MET stream, map it specifically
    if (goproStream) {
      command.outputOptions([
        "-map", `0:${goproStream.index}`,
        "-f rawvideo"
      ]);
    } else {
      // Otherwise, try to extract the first data stream
      command.outputOptions([
        "-map", "0:d:0", // Map the first data stream
        "-f rawvideo"
      ]);
    }

    command
      .save(outputBin)
      .on("end", async () => {
        try {
          const buffer = fs.readFileSync(outputBin);
          // Clean up temporary file
          await unlinkAsync(outputBin);
          resolve(buffer);
        } catch (err) {
          reject(new Error(`Failed to read extracted telemetry: ${err.message}`));
        }
      })
      .on("error", async (err) => {
        // Clean up temporary file if it exists
        if (fs.existsSync(outputBin)) {
          try {
            await unlinkAsync(outputBin);
          } catch (cleanupErr) {
            logger.warn(`Failed to clean up temporary file: ${cleanupErr.message}`);
          }
        }
        reject(new Error(`FFmpeg extraction failed: ${err.message}`));
      });
  });
}