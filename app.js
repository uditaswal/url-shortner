import express from 'express';
import helmet from 'helmet';
import { apiRouter, redirectRouter } from './routes/url.routes.js';
import staticRouter from './routes/static.routes.js';
import userRouter from './routes/user.routes.js';
import path from 'path'
import { fileURLToPath } from 'url';
import crypto from 'crypto';
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

    app.use((req, res, next) => {
        res.locals.cspNonce = crypto.randomBytes(16).toString("base64");
        next();
    });

    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                frameAncestors: ["'none'"],
                formAction: ["'self'"],
                upgradeInsecureRequests: null
            }
        }
    }));
    app.use(express.static(path.join(__dirname, "public")));
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(cookieParser());
    app.use(checkAuth);
    app.use(requestLogger);
    app.use((req, res, next) => {
        res.locals.user = req.user || null;
        next();
    });

    app.use('/', staticRouter);
    app.use('/api', apiRouter);
    app.use('/user', userRouter);
    app.use('/', redirectRouter);
    app.use(errorHandler);

    return app;
}

export default createApp;
