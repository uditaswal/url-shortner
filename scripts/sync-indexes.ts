import connectDB from "../dbConnection.js";
import config from "../util/config.util.js";

try {
    await connectDB(config.db.url, config.db.name, config.db.accountLabel, { syncIndexes: true });
    console.info("Database indexes synchronized.");
} finally {
    const { default: mongoose } = await import("mongoose");
    await mongoose.disconnect();
}
