# Video Telemetry Metadata Extractor

An automated system that extracts telemetry metadata (GPS coordinates, altitude, speed, timestamp) from GoPro and other action camera videos without compressing or modifying them.

## Features

- 📁 **Create Input Folder**: Create a folder named `input` in the main project directory
- 📁 **Create Output Folder**: Create a folder named `output_csv` in the main project directory
- 🗂 **Video Folder Watcher**: Automatically detects new video files dropped in `input/`
- ⚙️ **FFmpeg Metadata Extraction**: Uses FFmpeg to extract GPMF streams from GoPro videos
- 🧾 **CSV Output**: Produces .csv files with GPS, timestamp, altitude, and speed data
- 🔍 **Error Logging**: Captures extraction issues, missing streams, and parsing errors
- ⚡ **Batch Processing**: Processes all videos in the folder sequentially
- 🧠 **Format Agnostic**: Works with GoPro Max, Hero 8+, DJI, or other GPS-enabled videos

## Table of Contents
- [System Architecture](#system-architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Usage](#usage)
- [Output Example](#output-example)
- [CSV Output Format](#csv-output-format)
- [Future Enhancements](#future-enhancements)

## System Architecture

```
+--------------------+
|   Input Folder     |  ← User drops video files
+---------+----------+
          |
          v
+---------+----------+
|  FFmpeg Extractor  | → Extracts telemetry (GPMF stream)
+---------+----------+
          |
          v
+--------------------+
|  Telemetry Parser  | → Parses raw binary → JSON
+--------------------+
          |
          v
+--------------------+
| CSV Generator      | → Creates structured .csv in output_csv
+--------------------+
          |
          v
+--------------------+
| Logs + Reports     |
+--------------------+
```

## Tech Stack

| Layer | Tool/Library | Purpose |
|-------|-------------|---------|
| 🧠 Language | Node.js (v18+) | Main runtime |
| ⚙️ Video Processing | FFmpeg | Extracts telemetry streams |
| 🧾 Metadata Parser | gpmf-extract, gopro-telemetry | Reads GoPro Max/Hero GPS metadata |
| 📈 Output Formatter | csv-writer | Converts data to CSV |
| 📁 File Watcher | Node FS module | Monitors input folder |
| 🧰 Logging | winston | Handles logs and diagnostics |

## Project Structure

```
video-telemetry/
│
├── input/                      # Folder for raw videos
│   ├── video1.mp4
│   ├── video2.mp4
│
├── output_csv/                 # CSV output folder
│   ├── video1.csv
│   ├── video2.csv
│
├── logs/                       # Log files for each run
│   ├── process-2025-10-31.log
│
├── src/
│   ├── main.js                 # Main entry point
│   ├── extractMetadata.js      # FFmpeg-based extraction
│   ├── parseTelemetry.js       # Parse telemetry JSON
│   ├── csvWriter.js            # Write data to CSV
│   ├── utils/
│   │   ├── logger.js           # Winston-based logging
│   │   ├── fileHelper.js       # File cleanup, path utils
│
├── package.json
└── README.md
```

## Setup Instructions

1. **Initialize Node project**
   ```bash
   npm init -y
   ```

2. **Install dependencies**
   ```bash
   npm install ffmpeg-static fluent-ffmpeg csv-writer gpmf-extract gopro-telemetry winston
   ```

3. **Folder setup**
   ```bash
   mkdir input output_csv logs src src/utils
   ```

## Usage

1. Place your GoPro or action camera videos in the `input/` folder
2. Run the extraction process:
   ```bash
   npm start
   ```
   or
   ```bash
   node src/main.js
   ```

3. Check the `output_csv/` folder for the extracted telemetry data in CSV format
4. Check the `logs/` folder for processing logs

## Output Example

```
✅ Processing video1.mp4
✅ Output saved: output_csv/video1.csv
```

## CSV Output Format

| Timestamp | Latitude | Longitude | Altitude (m) | Speed (m/s) |
|-----------|----------|-----------|--------------|-------------|
| 0.0001 | 12.9716 | 77.5946 | 915.2 | 2.4 |
| 0.0002 | 12.9717 | 77.5947 | 914.9 | 3.0 |

## Future Enhancements

- 🌐 **Visualization**: Plot route on map (Leaflet.js / Mapbox)
- 🧩 **Format Compatibility**: Add support for DJI, Insta360, etc.
- 🔁 **Live Stream Support**: Extract telemetry from live feed
- ⚡ **Batch Mode CLI**: `npm run process --all` for bulk
- 📦 **Cloud Sync**: Push CSVs to S3 or GCP bucket
- 🧱 **API Integration**: REST API for external trigger