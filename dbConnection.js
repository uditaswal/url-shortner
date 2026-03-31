import mongoose from 'mongoose';
import { logError } from './util/logger.util.js';

export default async function connectDB(dbURL, dbAppName, accountLabel = "default") {
    try {
        mongoose.set("sanitizeFilter", true);
        await mongoose.connect(`${dbURL}${dbAppName}`);
        await Promise.all(
            Object.values(mongoose.models).map((model) => model.syncIndexes())
        );
        console.log(`mongodb connected on ${dbURL}${dbAppName} using ${accountLabel} at ${new Date().toString()}`);
    } catch (err) {
        logError(err, {
            source: "mongodb",
            details: {
                dbURL: `${dbURL}${dbAppName}`,
                accountLabel
            }
        });
        throw err;
    }
};
