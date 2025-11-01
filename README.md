# Video Telemetry Metadata Extractor

An automated system that extracts telemetry metadata (GPS coordinates, altitude, speed, timestamp) from GoPro and other action camera videos without compressing or modifying them.

## Features

- 📁 **Flexible Input Folder**: Specify any folder containing video files (no longer restricted to `input/`)
- 📁 **Interactive Input Path**: When running `npm start` or `npm run dev`, the application prompts for the input folder path
- 📁 **Create Output Folder**: Creates a folder named `output_csv` in the main project directory
- ⚙️ **FFmpeg Metadata Extraction**: Uses FFmpeg to extract GPMF streams from GoPro videos
- 🧾 **CSV Output**: Produces .csv files with GPS, timestamp, altitude, and speed data
- 🔍 **Error Logging**: Captures extraction issues, missing streams, and parsing errors
- ⚡ **Batch Processing**: Processes all videos in the folder sequentially
- 🧠 **High Precision**: Latitude and longitude values are preserved with up to 8 decimal places
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
|   Input Folder     |  ← User specifies folder with video files
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
| 📁 File Operations | Node FS module | Handles file operations |
| 🧰 Logging | winston | Handles logs and diagnostics |

## Project Structure

```
video-telemetry/
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
│   │   ├── fileHelper.js       # File operations
│   │   ├── cliHelper.js        # Command-line argument parsing
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
   mkdir output_csv logs src src/utils
   ```

## Usage

You can now specify any folder containing your videos:

1. Run the extraction process with interactive input path prompt:
   ```bash
   npm start
   ```
   or
   ```bash
   npm run dev
   ```
   The application will prompt you to enter the path to the folder containing your videos.

2. Run the extraction process with a custom input folder:
   ```bash
   npm start /path/to/your/videos
   ```
   or
   ```bash
   node src/main.js /path/to/your/videos
   ```

3. You can also use command-line options:
   ```bash
   node src/main.js --input /path/to/your/videos --output /path/to/output
   ```

4. Or use the short options:
   ```bash
   node src/main.js -i /path/to/your/videos -o /path/to/output
   ```

5. Check the `output_csv/` folder for the extracted telemetry data in CSV format
6. Check the `logs/` folder for processing logs

## Output Example

```
✅ Processing video1.mp4
✅ Output saved: output_csv/video1.csv
```

## CSV Output Format

| Timestamp | Latitude | Longitude | Altitude (m) | Speed (m/s) | DistanceFromPrevious (m) |
|-----------|----------|-----------|--------------|-------------|--------------------------|
| 0.0001 | 12.97160000 | 77.59460000 | 915.2 | 2.4 | 0 |
| 0.0002 | 12.97170000 | 77.59470000 | 914.9 | 3.0 | 50.2 |

Note: Latitude and longitude values are now preserved with up to 8 decimal places for higher precision.

## Future Enhancements

- 🌐 **Visualization**: Plot route on map (Leaflet.js / Mapbox)
- 🧩 **Format Compatibility**: Add support for DJI, Insta360, etc.
- 🔁 **Live Stream Support**: Extract telemetry from live feed
- ⚡ **Batch Mode CLI**: `npm run process --all` for bulk
- 📦 **Cloud Sync**: Push CSVs to S3 or GCP bucket
- 🧱 **API Integration**: REST API for external trigger