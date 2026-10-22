const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
import type { Request, RequestHandler } from "express";

function isCrossSiteBrowserRequest(req: Request) {
    // Fetch Metadata is emitted by modern browsers and avoids treating harmless
    // local origin variations or proxy headers as an attack.
    return req.get("sec-fetch-site") === "cross-site";
}

function isLogoutRequest(req: Request) {
    return req.path.endsWith("/auth/logout") || req.path.endsWith("/user/logout");
}

const enforceSameOrigin: RequestHandler = (req, res, next) => {
    // SameSite cookies remain the fallback for clients that do not send Fetch Metadata.
    // Logging out only invalidates the current session, so it is safe to allow.
    if (
        !UNSAFE_METHODS.has(req.method) ||
        isLogoutRequest(req) ||
        !isCrossSiteBrowserRequest(req)
    ) {
        return next();
    }

    const payload = { error: "Cross-site requests are not allowed." };
    if (
        req.originalUrl.startsWith("/api") ||
        req.xhr ||
        req.get("accept")?.includes("application/json")
    ) {
        return res.status(403).json(payload);
    }

    return res.status(403).render("login", payload);
};

export default enforceSameOrigin;
