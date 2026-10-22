import mongoose from "mongoose";
import connectDB from "../dbConnection.js";
import config from "../util/config.util.js";

const startedAt = Date.now();

try {
    const connection = await connectDB(config.db.url, config.db.name, config.db.accountLabel, {
        syncIndexes: false
    });

    process.stdout.write(
        `MongoDB connection check passed for ${connection.name} on ${connection.host} in ${Date.now() - startedAt} ms.\n`
    );
} catch (error) {
    const message = error instanceof Error ? error.message : "Unknown connection error";
    process.stderr.write(`MongoDB connection check failed: ${message}\n`);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
