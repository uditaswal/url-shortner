import { logError } from "../util/logger.util.js";

function isApiRequest(req) {
    return req.originalUrl.startsWith("/api") || req.xhr || req.get("accept")?.includes("application/json");
}

const errorHandler = (err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    logError(err, {
        source: "express",
        details: {
            method: req.method,
            path: req.path,
            url: req.originalUrl,
            ip: req.ip || req.socket?.remoteAddress || null,
            userId: req.user?._id || req.user?.id || null,
            query: req.query,
            params: req.params
        }
    });

    const statusCode = err.statusCode || err.status || 500;
    const message = statusCode >= 500 ? "Internal Server Error" : err.message;

    if (isApiRequest(req)) {
        return res.status(statusCode).json({
            error: message
        });
    }

    return res.status(statusCode).render("login", {
        error: message
    });
};

export default errorHandler;
