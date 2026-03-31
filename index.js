import connectDB from './dbConnection.js'
import { createApp } from './app.js';
import config from './util/config.util.js';
import logger from "./util/logger.util.js"

const app = createApp();
const PORT = config.port;

// mongodb Connection
connectDB(config.db.url, config.db.name, config.db.accountLabel);

app.listen(PORT, () => logger.info(`Server is listening on http://localhost:${PORT}/ at ${new Date().toString()} `));
