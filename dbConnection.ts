import mongoose from "mongoose";
import logger, { logError } from "./util/logger.util.js";

interface ConnectionTarget {
    protocol: string;
    host: string;
    database: string;
}

function getConnectionTarget(dbURL: string, dbName: string): ConnectionTarget {
    try {
        const parsedUrl = new globalThis.URL(dbURL);
        return {
            protocol: parsedUrl.protocol.replace(":", ""),
            host: parsedUrl.host,
            database: dbName
        };
    } catch {
        return {
            protocol: "mongodb",
            host: "invalid-url",
            database: dbName
        };
    }
}

export default async function connectDB(
    dbURL: string,
    dbName: string,
    accountLabel = "default",
    { syncIndexes = false }: { syncIndexes?: boolean } = {}
) {
    if (typeof dbURL !== "string" || !dbURL.trim()) {
        throw new Error("MongoDB connection URL is required.");
    }

    if (typeof dbName !== "string" || !dbName.trim()) {
        throw new Error("MongoDB database name is required.");
    }

    const target = getConnectionTarget(dbURL, dbName);

    try {
        mongoose.set("sanitizeFilter", true);
        await mongoose.connect(dbURL, {
            dbName,
            serverSelectionTimeoutMS: 15000,
            autoIndex:
                !process.env.CI &&
                process.env.APP_ENV !== "production" &&
                process.env.NODE_ENV !== "production"
        });
        const database = mongoose.connection.db;
        if (!database) {
            throw new Error("MongoDB connection is open but no database is selected.");
        }
        await database.admin().command({ ping: 1 });

        if (syncIndexes) {
            await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
        }

        logger.info("MongoDB connection established.", {
            event: "mongodb_connected",
            accountLabel,
            target
        });

        return mongoose.connection;
    } catch (err) {
        logError(err, {
            source: "mongodb",
            details: {
                accountLabel,
                target
            }
        });

        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect().catch(() => {});
        }

        throw err;
    }
}
