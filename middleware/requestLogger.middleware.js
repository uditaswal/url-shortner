import { logHttpRequest } from "../util/logger.util.js";

function normalizeResponseBody(body) {
    if (body === undefined) {
        return null;
    }

    if (Buffer.isBuffer(body)) {
        return {
            type: "buffer",
            size: body.length
        };
    }

    if (typeof body === "string") {
        return {
            type: "text",
            size: body.length,
            preview: body.slice(0, 500)
        };
    }

    return {
        type: "json",
        body
    };
}

const requestLogger = (req, res, next) => {
    const start = Date.now();
    let responsePayload = null;

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalRender = res.render.bind(res);

    res.json = (body) => {
        responsePayload = normalizeResponseBody(body);
        return originalJson(body);
    };

    res.send = (body) => {
        responsePayload = normalizeResponseBody(body);
        return originalSend(body);
    };

    res.render = (view, locals, callback) => {
        const resolvedLocals =
            typeof locals === "function" || locals === undefined ? null : locals;

        responsePayload = {
            type: "view",
            view,
            locals: resolvedLocals ? Object.keys(resolvedLocals) : []
        };

        return originalRender(view, locals, callback);
    };

    res.on("finish", () => {
        const duration = Date.now() - start;
        logHttpRequest(req, res, duration, responsePayload);
    });

    next();
};

export default requestLogger;
