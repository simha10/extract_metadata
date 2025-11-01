import fs from "fs";
import path from "path";
import chalk from "chalk";
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp }) => `[${timestamp}] ${level}: ${message}`)
  ),
  transports: [
    new winston.transports.File({ filename: "./logs/process.log" }),
    new winston.transports.Console()
  ]
});

export default logger;

// Ensure logs directory exists and set up logging to file
const LOGS_DIR = "./logs";
const LOG_FILE = path.join(LOGS_DIR, "compression.log");

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function writeToLogFile(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // Write to file
  fs.appendFileSync(LOG_FILE, logMessage);
}

export function logInfo(msg) {
  console.log(chalk.cyan("[INFO]"), msg);
  writeToLogFile(`[INFO] ${msg}`);
}

export function logSuccess(msg) {
  console.log(chalk.green("[SUCCESS]"), msg);
  writeToLogFile(`[SUCCESS] ${msg}`);
}

export function logError(msg) {
  console.log(chalk.red("[ERROR]"), msg);
  writeToLogFile(`[ERROR] ${msg}`);
}