import express from "express";
import {
    deleteShortUrl,
    generateShortId,
    getShortURLAnalytics,
    moderateShortUrl,
    redirectToShortURL,
    updateShortUrl
} from "../controller/url.controller.js";
import { restrictToAdminOnly, restrictToLogginUserOnly } from "../middleware/auth.middleware.js";
import { urlCreateRateLimiter } from "../middleware/rateLimiter.middleware.js";

const apiRouter = express.Router();
const redirectRouter = express.Router();

apiRouter.route("/").get((req, res) => res.status(200).json({ msg: "Hello from server" })).post(urlCreateRateLimiter, generateShortId);
apiRouter.route("/analytics/:shortId").get(restrictToLogginUserOnly, getShortURLAnalytics);
apiRouter.route("/manage/:shortId").post(restrictToLogginUserOnly, updateShortUrl);
apiRouter.route("/delete/:shortId").post(restrictToLogginUserOnly, deleteShortUrl);
apiRouter.route("/admin/moderate/:shortId").post(restrictToAdminOnly, moderateShortUrl);

redirectRouter.route("/:shortId").get(redirectToShortURL);

export { apiRouter, redirectRouter };
