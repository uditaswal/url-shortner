import { logHttpRequest } from "../util/logger.util.js";
import type { RequestHandler, Response } from "express";

type ResponsePayload = { type: string; size?: number; view?: string } | null;

function normalizeResponseBody(body: unknown): ResponsePayload {
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
            size: body.length
        };
    }

    return {
        type: "json"
    };
}

const requestLogger: RequestHandler = (req, res, next) => {
    const start = Date.now();
    let responsePayload: ResponsePayload = null;

    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const originalRender = res.render.bind(res);

    res.json = ((body: unknown) => {
        responsePayload = normalizeResponseBody(body);
        return originalJson(body);
    }) as Response["json"];

    res.send = ((body: unknown) => {
        responsePayload = normalizeResponseBody(body);
        return originalSend(body);
    }) as Response["send"];

    res.render = ((
        view: string,
        locals?: object,
        callback?: (err: Error | null, html?: string) => void
    ) => {
        responsePayload = {
            type: "view",
            view: typeof view === "string" ? view : "unknown"
        };

        return originalRender(view, locals, callback);
    }) as Response["render"];

    res.on("finish", () => {
        const duration = Date.now() - start;
        logHttpRequest(req, res, duration, responsePayload);
    });

    next();
};

export default requestLogger;
