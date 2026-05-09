import express from "express";
import {
    deleteShortUrl,
    generateShortId,
    getShortURLAnalytics,
    moderateShortUrl,
    redirectToShortURL,
    updateShortUrl
} from "../controller/url.controller.js";
import { restrictToAdminOnly, restrictToLoginUserOnly } from "../middleware/auth.middleware.js";
import { urlCreateRateLimiter } from "../middleware/rateLimiter.middleware.js";

function asJson(req, _res, next) {
    req.responseMode = "json";
    next();
}

function asHtml(req, _res, next) {
    req.responseMode = "html";
    next();
}

/**
 * @swagger
 * tags:
 *   - name: URLs
 *     description: Short URL creation, management, analytics, and moderation APIs.
 *
 * components:
 *   schemas:
 *     UrlInput:
 *       type: object
 *       required:
 *         - url
 *       properties:
 *         url:
 *           type: string
 *           example: https://example.com/docs
 *         customShortId:
 *           type: string
 *           example: docs2026
 *         expiresOn:
 *           type: string
 *           example: 2026-12-31
 *         expiresAtTime:
 *           type: string
 *           example: 23:59
 *     UrlResource:
 *       type: object
 *       properties:
 *         shortId:
 *           type: string
 *           example: docs2026
 *         redirectUrl:
 *           type: string
 *           example: https://example.com/docs
 *         shortUrl:
 *           type: string
 *           example: http://localhost:3000/docs2026
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         isDisabled:
 *           type: boolean
 *         disabledReason:
 *           type: string
 *           nullable: true
 *         status:
 *           type: string
 *           example: active
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         lastEditedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         visitCount:
 *           type: integer
 *     UrlResponse:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *         url:
 *           $ref: '#/components/schemas/UrlResource'
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         error:
 *           type: string
 *     ModerationInput:
 *       type: object
 *       required:
 *         - action
 *       properties:
 *         action:
 *           type: string
 *           enum: [disable, enable]
 *         disabledReason:
 *           type: string
 *           example: Abuse review
 *     UrlAnalyticsResponse:
 *       type: object
 *       properties:
 *         shortId:
 *           type: string
 *         redirectUrl:
 *           type: string
 *         shortUrl:
 *           type: string
 *         count:
 *           type: integer
 *         totalVisitsIncludingBots:
 *           type: integer
 *         botVisits:
 *           type: integer
 *         status:
 *           type: string
 *         expiresAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         visitHistory:
 *           type: array
 *           items:
 *             type: object
 */
const apiRouter = express.Router();
const uiUrlRouter = express.Router();
const legacyUrlRouter = express.Router();
const redirectRouter = express.Router();

apiRouter.use(asJson);
uiUrlRouter.use(asHtml);
legacyUrlRouter.use(asHtml);

/**
 * @swagger
 * /api:
 *   get:
 *     tags:
 *       - URLs
 *     summary: Get API welcome payload.
 *     responses:
 *       200:
 *         description: API welcome message.
 */
apiRouter.get("/", (_req, res) => res.status(200).json({ message: "URL Shortener API" }));

/**
 * @swagger
 * /api/urls:
 *   post:
 *     tags:
 *       - URLs
 *     summary: Create a short URL.
 *     description: Creates a short URL for the supplied destination. Works for guests and logged-in users.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UrlInput'
 *     responses:
 *       201:
 *         description: Short URL created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UrlResponse'
 *       200:
 *         description: Existing short URL returned for duplicate destination.
 *       400:
 *         description: Invalid payload.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Custom short ID conflict.
 */
apiRouter.route("/urls")
    .post(urlCreateRateLimiter, generateShortId);

/**
 * @swagger
 * /api/urls/{shortId}:
 *   put:
 *     tags:
 *       - URLs
 *     summary: Replace a short URL configuration.
 *     parameters:
 *       - in: path
 *         name: shortId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UrlInput'
 *     responses:
 *       200:
 *         description: Short URL updated.
 *       400:
 *         description: Invalid payload.
 *       404:
 *         description: Short URL not found.
 *   patch:
 *     tags:
 *       - URLs
 *     summary: Partially update a short URL configuration.
 *     parameters:
 *       - in: path
 *         name: shortId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UrlInput'
 *     responses:
 *       200:
 *         description: Short URL updated.
 *   delete:
 *     tags:
 *       - URLs
 *     summary: Delete a short URL.
 *     parameters:
 *       - in: path
 *         name: shortId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Short URL deleted.
 *       404:
 *         description: Short URL not found.
 */
apiRouter.route("/urls/:shortId")
    .put(restrictToLoginUserOnly, updateShortUrl)
    .patch(restrictToLoginUserOnly, updateShortUrl)
    .delete(restrictToLoginUserOnly, deleteShortUrl);

/**
 * @swagger
 * /api/urls/{shortId}/analytics:
 *   get:
 *     tags:
 *       - URLs
 *     summary: Get analytics for a short URL.
 *     parameters:
 *       - in: path
 *         name: shortId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Analytics payload.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UrlAnalyticsResponse'
 *       404:
 *         description: Short URL not found.
 *
 * /api/admin/urls/{shortId}/moderation:
 *   patch:
 *     tags:
 *       - URLs
 *     summary: Enable or disable a short URL as an admin.
 *     parameters:
 *       - in: path
 *         name: shortId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ModerationInput'
 *     responses:
 *       200:
 *         description: Moderation updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UrlResponse'
 *       403:
 *         description: Admin access required.
 */
apiRouter.get("/urls/:shortId/analytics", restrictToLoginUserOnly, getShortURLAnalytics);
apiRouter.patch("/admin/urls/:shortId/moderation", restrictToAdminOnly, moderateShortUrl);

uiUrlRouter.post("/urls", urlCreateRateLimiter, generateShortId);
uiUrlRouter.post("/urls/:shortId", restrictToLoginUserOnly, updateShortUrl);
uiUrlRouter.post("/urls/:shortId/delete", restrictToLoginUserOnly, deleteShortUrl);
uiUrlRouter.post("/admin/urls/:shortId/moderation", restrictToAdminOnly, moderateShortUrl);

legacyUrlRouter.post("/api", urlCreateRateLimiter, generateShortId);
legacyUrlRouter.post("/api/manage/:shortId", restrictToLoginUserOnly, updateShortUrl);
legacyUrlRouter.post("/api/delete/:shortId", restrictToLoginUserOnly, deleteShortUrl);
legacyUrlRouter.post("/api/admin/moderate/:shortId", restrictToAdminOnly, moderateShortUrl);

redirectRouter.get("/:shortId", redirectToShortURL);

export { apiRouter, uiUrlRouter, legacyUrlRouter, redirectRouter };
