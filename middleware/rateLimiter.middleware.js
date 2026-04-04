import rateLimit from "express-rate-limit";
import MongoRateLimitStore from "../util/rateLimitStore.util.js";

function buildRateLimitHandler(message) {
    return (req, res) => {
        if (req.originalUrl.startsWith("/api") || req.xhr || req.get("accept")?.includes("application/json")) {
            return res.status(429).json({
                error: message
            });
        }

        const view = req.originalUrl.includes("/login") ? "login" : req.originalUrl.includes("/user") ? "signup" : "home";

        return res.status(429).render(view, {
            error: message,
            values: {
                name: typeof req.body?.name === "string" ? req.body.name : "",
                username: typeof req.body?.username === "string" ? req.body.username : "",
                url: typeof req.body?.url === "string" ? req.body.url : "",
                customShortId: typeof req.body?.customShortId === "string" ? req.body.customShortId : "",
                expiresAt: typeof req.body?.expiresAt === "string" ? req.body.expiresAt : ""
            },
            isGuestMode: !req.user,
            urls: []
        });
    };
}

function buildStore(prefix) {
    return new MongoRateLimitStore(prefix);
}

export const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("auth"),
    handler: buildRateLimitHandler("Too many authentication attempts. Please try again in 15 minutes.")
});

export const urlCreateRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    store: buildStore("url-create"),
    handler: buildRateLimitHandler("Too many URL creation requests. Please slow down and try again shortly.")
});
