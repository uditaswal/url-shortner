import fs from "fs";
import os from "os";
import path from "path";
import util from "util";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import type { Request, Response } from "express";

const isVercel = process.env.VERCEL === "1";
const useStdout =
    isVercel || process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
const logsDir = process.env.LOG_DIR
    ? path.resolve(process.env.LOG_DIR)
    : isVercel
      ? path.join(os.tmpdir(), "url-shortener-logs")
      : path.resolve("logs");

function buildTransports() {
    fs.mkdirSync(logsDir, { recursive: true });
    const transports: winston.transport[] = [
        new DailyRotateFile({
            dirname: logsDir,
            filename: "app-%DATE%.log",
            datePattern: "DD-MMM-YYYY",
            maxFiles: "15d",
            maxSize: "100m",
            zippedArchive: true
        })
    ];

    if (useStdout) {
        transports.push(new winston.transports.Console());
    }

    return transports;
}

const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: buildTransports()
});

const CONSOLE_LEVEL_MAP = {
    log: "info",
    info: "info",
    warn: "warn",
    error: "error",
    debug: "debug"
};

const SENSITIVE_KEY = /password|secret|token|authorization|cookie|api[-_]?key|credential/i;
const CONNECTION_CREDENTIAL = /([a-z][a-z\d+.-]*:\/\/)[^\s@/:]+:[^\s@]+@/gi;
const INLINE_SECRET = /\b(password|secret|token|api[-_]?key|authorization)\s*[:=]\s*[^\s,;)}\]]+/gi;

function redactString(value: string): string {
    return String(value)
        .replace(CONNECTION_CREDENTIAL, "$1[redacted]@")
        .replace(INLINE_SECRET, "$1=[redacted]");
}

function serializeValue(value: unknown): unknown {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: redactString(value.message),
            stack: redactString(value.stack || "")
        };
    }

    if (value === undefined) {
        return "[undefined]";
    }

    if (typeof value === "bigint") {
        return value.toString();
    }

    if (typeof value === "string") {
        return redactString(value);
    }

    if (Array.isArray(value)) {
        return value.map(serializeValue);
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, item]) => [
                key,
                SENSITIVE_KEY.test(key) ? "[redacted]" : serializeValue(item)
            ])
        );
    }

    return value;
}

function buildMessage(args: unknown[]): string {
    return util.format(...args);
}

export function logHttpRequest(
    req: Request,
    res: Response,
    durationMs: number,
    response: unknown = null
) {
    logger.log({
        level: "info",
        message: "HTTP request",
        event: "http_request",
        source: "express",
        http: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            responseTimeMs: durationMs,
            contentLength: res.getHeader("content-length") || null
        },
        response: serializeValue(response)
    });
}

export function logError(error: unknown, context: { source?: string; details?: unknown } = {}) {
    const normalizedError =
        error instanceof Error
            ? {
                  name: error.name,
                  message: redactString(error.message),
                  stack: redactString(error.stack || "")
              }
            : {
                  message: typeof error === "string" ? error : "Unknown error",
                  details: serializeValue(error)
              };

    logger.log({
        level: "error",
        message: normalizedError.message,
        event: "application_error",
        source: context.source || "application",
        error: normalizedError,
        context: serializeValue(context.details || null)
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

    (Object.entries(CONSOLE_LEVEL_MAP) as [keyof typeof CONSOLE_LEVEL_MAP, string][]).forEach(
        ([method, level]) => {
            console[method] = (...args: unknown[]) => {
                logger.log({
                    level,
                    message: buildMessage(args),
                    event: "console",
                    source: "node-console",
                    console: {
                        method,
                        message: buildMessage(args),
                        args: args.map(serializeValue)
                    }
                });

                if (!useStdout) {
                    originalConsole[method](...args);
                }
            };
        }
    );

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

    const handleFatalError = (error: unknown, type: string) => {
        logError(error, {
            source: "process",
            details: {
                type
            }
        });
        process.exitCode = 1;
        setTimeout(() => process.exit(1), 100).unref();
    };

    process.on("uncaughtException", (error) => {
        handleFatalError(error, "uncaughtException");
    });

    process.on("unhandledRejection", (reason) => {
        handleFatalError(reason, "unhandledRejection");
    });

    Object.defineProperty(process, "__loggerErrorHandlersInstalled", {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
    });
}

export default logger;
