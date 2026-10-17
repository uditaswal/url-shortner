import mongoose from "mongoose";
import logger, { logError } from "./util/logger.util.js";

function getConnectionTarget(dbURL, dbName) {
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
    dbURL,
    dbName,
    accountLabel = "default",
    { syncIndexes = true } = {}
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
            serverSelectionTimeoutMS: 15000
        });
        await mongoose.connection.db.admin().command({ ping: 1 });

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
