import fs from "node:fs";
import path from "node:path";

const LOG_DIRECTORY = path.resolve("logs");
const LOG_FILE = path.join(
    LOG_DIRECTORY,
    "console.log"
);

if (!fs.existsSync(LOG_DIRECTORY)) {
    fs.mkdirSync(LOG_DIRECTORY, {
        recursive: true
    });
}

/*
 * Keep the original console functions.
 */
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;

/*
 * Format values nicely.
 */
function formatArguments(args) {
    return args
        .map(arg => {
            if (typeof arg === "string") {
                return arg;
            }

            if (arg instanceof Error) {
                return arg.stack || arg.message;
            }

            try {
                return JSON.stringify(
                    arg,
                    null,
                    2
                );
            } catch {
                return String(arg);
            }
        })
        .join(" ");
}

/*
 * Write a line to the log file.
 */
function writeLog(
    level,
    args
) {
    const timestamp =
        new Date().toISOString();

    const line =
        `[${timestamp}] [${level}] ${formatArguments(args)}\n`;

    try {
        fs.appendFileSync(
            LOG_FILE,
            line,
            "utf8"
        );
    } catch (error) {
        originalError(
            "Failed to write console log:",
            error
        );
    }
}

/*
 * Override console.log
 */
console.log = (...args) => {
    writeLog("LOG", args);

    originalLog(...args);
};

/*
 * Override console.error
 */
console.error = (...args) => {
    writeLog("ERROR", args);

    originalError(...args);
};

/*
 * Override console.warn
 */
console.warn = (...args) => {
    writeLog("WARN", args);

    originalWarn(...args);
};

/*
 * Override console.info
 */
console.info = (...args) => {
    writeLog("INFO", args);

    originalInfo(...args);
};

/*
 * Export the current log file.
 */
export function getLogFilePath() {
    return LOG_FILE;
}

/*
 * Clear the current log.
 */
export function clearLogs() {
    fs.writeFileSync(
        LOG_FILE,
        "",
        "utf8"
    );
}

/*
 * Get the current log size.
 */
export function getLogSize() {
    try {
        return fs.statSync(
            LOG_FILE
        ).size;
    } catch {
        return 0;
    }
}