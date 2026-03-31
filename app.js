import express from 'express';
import helmet from 'helmet';
import router from './routes/url.routes.js';
import staticRouter from './routes/static.routes.js';
import userRouter from './routes/user.routes.js';
import path from 'path'
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { checkAuth } from './middleware/auth.middleware.js';
import requestLogger from './middleware/requestLogger.middleware.js';
import errorHandler from './middleware/errorHandler.middleware.js';
import { installConsoleLogger, installProcessErrorHandlers } from "./util/logger.util.js"

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename)

installConsoleLogger();
installProcessErrorHandlers();

export function createApp() {
    const app = express();

    app.set("view engine", "ejs");
    app.set("views", path.join(__dirname, "views"));

    app.use(helmet({
        contentSecurityPolicy: false
    }));
    app.use(express.static(path.join(__dirname, "public")));
    app.use(express.json());
    app.use(express.static("public"));
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(checkAuth);
    app.use(requestLogger);
    app.use((req, res, next) => {
        res.locals.user = req.user || null;
        next();
    });

    app.use('/', staticRouter);
    app.use('/api', router);
    app.use('/user', userRouter);
    app.use('/', router);
    app.use(errorHandler);

    return app;
}

export default createApp;
