import mongoose from 'mongoose';
import { logError } from './util/logger.util.js';

export default async function connectDB(dbURL, dbName, accountLabel = "default") {
    const first = dbURL.indexOf(":");
    const second = dbURL.indexOf(":", first + 1);
    const dbConnection = dbURL.substring(0, second + 1);
    try {

        mongoose.set("sanitizeFilter", true);
        await mongoose.connect(`${dbURL}`, { dbName });
        await Promise.all(
            Object.values(mongoose.models).map((model) => model.syncIndexes())
        );
        console.log(`mongodb connected on ${dbConnection} using ${accountLabel} to database ${mongoose.connection.name} at ${new Date().toString()}`);
    } catch (err) {
        logError(err, {
            source: "mongodb",
            details: {
                dbURL: `${dbURL}`,
                dbName,
                accountLabel
            }
        });
        throw err;
    }
};
