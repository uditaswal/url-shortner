import fs from "fs";
import path from "path";
import util from "util";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const logsDir = path.resolve("logs");
fs.mkdirSync(logsDir, { recursive: true });

const transport = new DailyRotateFile({
    dirname: logsDir,
    filename: "app-%DATE%.log",
    datePattern: "DD-MMM-YYYY",
    maxFiles: "15d",
    maxSize: "100m",
    zippedArchive: true
});

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [transport]
});

const CONSOLE_LEVEL_MAP = {
    log: "info",
    info: "info",
    warn: "warn",
    error: "error",
    debug: "debug"
};

function serializeValue(value) {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack
        };
    }

    if (value === undefined) {
        return "[undefined]";
    }

    if (typeof value === "bigint") {
        return value.toString();
    }

    return value;
}

function buildMessage(args) {
    return util.format(...args);
}

export function logHttpRequest(req, res, durationMs, response = null) {
    logger.log({
        level: "info",
        event: "http_request",
        source: "express",
        http: {
            method: req.method,
            path: req.path,
            url: req.originalUrl,
            statusCode: res.statusCode,
            responseTimeMs: durationMs,
            ip: req.ip || req.socket?.remoteAddress || null,
            userAgent: req.get("user-agent") || null,
            contentLength: res.getHeader("content-length") || null,
            referer: req.get("referer") || null,
            query: req.query,
            params: req.params
        },
        response,
        user: req.user
            ? {
                id: req.user._id || req.user.id || null
            }
            : null
    });
}

export function logError(error, context = {}) {
    const normalizedError =
        error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            }
            : {
                message: typeof error === "string" ? error : "Unknown error",
                details: serializeValue(error)
            };

    logger.log({
        level: "error",
        event: "application_error",
        source: context.source || "application",
        error: normalizedError,
        context: context.details || null
    });
}

export function installConsoleLogger() {
    if (console.__loggerPatched) {
        return;
    }

    const originalConsole = {
        log: console.log.bind(console),
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
        debug: console.debug.bind(console)
    };

    Object.entries(CONSOLE_LEVEL_MAP).forEach(([method, level]) => {
        console[method] = (...args) => {
            logger.log({
                level,
                event: "console",
                source: "node-console",
                console: {
                    method,
                    message: buildMessage(args),
                    args: args.map(serializeValue)
                }
            });

            originalConsole[method](...args);
        };
    });

    Object.defineProperty(console, "__loggerPatched", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
    });
}

export function installProcessErrorHandlers() {
    if (process.__loggerErrorHandlersInstalled) {
        return;
    }

    process.on("uncaughtException", (error) => {
        logError(error, {
            source: "process",
            details: {
                type: "uncaughtException"
            }
        });
    });

    process.on("unhandledRejection", (reason) => {
        logError(reason, {
            source: "process",
            details: {
                type: "unhandledRejection"
            }
        });
    });

    Object.defineProperty(process, "__loggerErrorHandlersInstalled", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
    });
}

export default logger;
