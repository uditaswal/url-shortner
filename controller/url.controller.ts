import mongoose from "mongoose";
import type { Request, Response } from "express";
import type { HydratedDocument } from "mongoose";
import URL from "../model/url.models.js";
import type { UrlFields } from "../model/url.models.js";
import { customAlphabet, nanoid } from "nanoid";
import {
    attachVisitCounts,
    deleteVisitsForUrl,
    getUrlAnalytics,
    recordVisit
} from "../util/analytics.util.js";
import { logError } from "../util/logger.util.js";
import config from "../util/config.util.js";
import {
    isSafePlainInput,
    isValidShortId,
    normalizeDateTimeInput,
    normalizeShortIdInput,
    normalizeUrlInput,
    parseExpirationInput,
    validateHttpUrl
} from "../util/validation.util.js";

interface NormalizedCreatePayload {
    url: string;
    customShortId: string;
    expiresAtInput: string;
    expiresOnInput: string;
    expiresAtTimeInput: string;
    rawExpiresOnInput: string;
    rawExpiresAtTimeInput: string;
    hasSplitExpirationInput: boolean;
    expiresAt: Date | null;
    missingExpirationDate: boolean;
    missingExpirationTime: boolean;
}

function isDuplicateKeyError(error: unknown): error is { code: number } {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

function isJsonRequest(req: Request) {
    return req.responseMode === "json";
}

function buildShortUrl(req: Request, shortId: string) {
    const baseUrl = config.publicBaseUrl || `${req.protocol}://${req.get("host")}`;
    return `${baseUrl}/${shortId}`;
}

const RESERVED_SHORT_IDS = new Set([
    "api",
    "ui",
    "login",
    "signup",
    "profile",
    "privacy",
    "terms",
    "acceptable-use",
    "report-abuse",
    "legacy",
    "user",
    "health",
    "images",
    "css",
    "js",
    "favicon.ico"
]);

function isReservedShortId(value: string) {
    return RESERVED_SHORT_IDS.has(value.toLowerCase());
}

function buildFormValues(payload: NormalizedCreatePayload) {
    return {
        ...payload,
        expiresAt: payload.expiresAt?.toISOString() || "",
        expiresOn: payload.expiresOnInput || "",
        expiresAtTime: payload.expiresAtTimeInput || ""
    };
}

const createAliasSuffix = customAlphabet("abcdefghjkmnpqrstuvwxyz23456789", 4);

async function suggestAvailableAlias(requestedAlias: string): Promise<string> {
    const base = normalizeShortIdInput(requestedAlias).slice(0, 15) || "short-link";

    for (let attempt = 0; attempt < 10; attempt += 1) {
        const suggestion = `${base}-${createAliasSuffix()}`;
        if (!(await URL.exists({ shortId: suggestion }))) {
            return suggestion;
        }
    }

    return nanoid(8);
}

async function buildAliasConflict(req: Request, requestedAlias: string) {
    const suggestedAlias = await suggestAvailableAlias(requestedAlias);

    return {
        error: `That custom alias is already taken. Try "${suggestedAlias}".`,
        suggestedAlias,
        suggestedShortUrl: buildShortUrl(req, suggestedAlias)
    };
}

function buildUrlResponse(
    req: Request,
    entry: HydratedDocument<UrlFields> & { visitCount?: number }
) {
    return {
        shortId: entry.shortId,
        redirectUrl: entry.redirectUrl,
        shortUrl: buildShortUrl(req, entry.shortId),
        expiresAt: entry.expiresAt,
        isDisabled: entry.isDisabled,
        disabledReason: entry.disabledReason,
        status: getUrlStatus(entry),
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        lastEditedAt: entry.lastEditedAt,
        visitCount:
            entry.visitCount ?? (entry.visitHistory || []).filter((visit) => !visit.isBot).length
    };
}

function getVisitorCountry(req: Request): string {
    const country =
        req.get("cf-ipcountry") ||
        req.get("x-vercel-ip-country") ||
        req.get("cloudfront-viewer-country") ||
        req.headers["x-country-code"];

    if (!country || !/^[A-Za-z]{2}$/.test(String(country)) || country === "XX") {
        return "Unknown";
    }

    return String(country).toUpperCase();
}

function isBotRequest(req: Request): boolean {
    const userAgent = req.get("user-agent") || "";
    return /(bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|discord|telegram|linkedinbot)/i.test(
        userAgent
    );
}

function isExpired(entry: Pick<UrlFields, "expiresAt"> | null | undefined): boolean {
    return Boolean(entry?.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now());
}

function getUrlStatus(entry: Pick<UrlFields, "isDisabled" | "expiresAt"> | null | undefined) {
    if (entry?.isDisabled) {
        return "disabled";
    }

    if (isExpired(entry)) {
        return "expired";
    }

    return "active";
}

function getOwnerId(req: Request) {
    return req.user?._id || null;
}

function buildEditableValues(
    entry: Pick<UrlFields, "redirectUrl" | "shortId" | "expiresAt"> | null
) {
    const expirationDate = entry?.expiresAt ? new Date(entry.expiresAt) : null;

    return {
        url: entry?.redirectUrl || "",
        customShortId: entry?.shortId || "",
        expiresAt: expirationDate ? expirationDate.toISOString().slice(0, 16) : "",
        expiresOn: expirationDate ? expirationDate.toISOString().slice(0, 10) : "",
        expiresAtTime: expirationDate ? expirationDate.toISOString().slice(11, 16) : ""
    };
}

function buildOwnerFilter(shortId: string, req: Request) {
    return req.user?.isAdmin ? { shortId } : { shortId, createdBy: req.user?._id };
}

async function loadDashboardUrls(req: Request) {
    if (!req.user) {
        return [];
    }

    const urls = await attachVisitCounts(
        await URL.find({ createdBy: req.user._id }).sort({ createdAt: -1 })
    );
    return urls.map((item) => ({
        ...item,
        statusLabel: getUrlStatus(item)
    }));
}

async function renderHomeWithState(
    req: Request,
    res: Response,
    extras: {
        values?: Record<string, unknown>;
        error?: string | null;
        url?: string | null;
        successMessage?: string | null;
    } = {},
    statusCode = 200
) {
    const userUrls = await loadDashboardUrls(req);

    return res.status(statusCode).render("home", {
        urls: userUrls,
        isGuestMode: !req.user,
        dashboardFilters: {
            search: "",
            status: "all",
            sortBy: "createdAt",
            order: "desc"
        },
        values: extras.values || {},
        error: extras.error || null,
        url: extras.url || null,
        successMessage: extras.successMessage || null
    });
}

export function normalizeCreatePayload(
    body: Record<string, unknown> = {}
): NormalizedCreatePayload {
    const expiresOnInput = normalizeDateTimeInput(body.expiresOn || "");
    const expiresAtTimeInput = normalizeDateTimeInput(body.expiresAtTime || "");
    const legacyExpiresAtInput = normalizeDateTimeInput(body.expiresAt || "");
    const hasSplitExpirationInput = Boolean(expiresOnInput || expiresAtTimeInput);

    const resolvedExpiresOnInput = expiresOnInput;
    const resolvedExpiresAtTimeInput = expiresAtTimeInput;
    const expiresAtInput =
        legacyExpiresAtInput ||
        [resolvedExpiresOnInput, resolvedExpiresAtTimeInput].filter(Boolean).join(" ");
    const expiresAt = legacyExpiresAtInput ? parseExpirationInput(legacyExpiresAtInput) : null;

    return {
        url: normalizeUrlInput(body.url || ""),
        customShortId: normalizeShortIdInput(body.customShortId || ""),
        expiresAtInput,
        expiresOnInput: resolvedExpiresOnInput,
        expiresAtTimeInput: resolvedExpiresAtTimeInput,
        rawExpiresOnInput: expiresOnInput,
        rawExpiresAtTimeInput: expiresAtTimeInput,
        hasSplitExpirationInput,
        expiresAt,
        missingExpirationDate: Boolean(!expiresOnInput && expiresAtTimeInput),
        missingExpirationTime: Boolean(expiresOnInput && !expiresAtTimeInput)
    };
}

export function validateCreatePayload(payload: NormalizedCreatePayload): string | null {
    if (!payload.url) {
        return "URL is required.";
    }

    if (!validateHttpUrl(payload.url)) {
        return "Enter a valid URL starting with http:// or https://.";
    }

    if (payload.customShortId && !isValidShortId(payload.customShortId)) {
        return "Short ID must be 6 to 20 characters and can only use letters, numbers, hyphens, or underscores.";
    }

    if (payload.customShortId && isReservedShortId(payload.customShortId)) {
        return "That custom alias is reserved by the application. Choose another one.";
    }

    if (payload.missingExpirationDate || payload.missingExpirationTime) {
        return "Choose both an expiration date and time.";
    }

    if (payload.expiresAtInput) {
        if (!payload.expiresAt) {
            return "Expiration must include a time zone.";
        }

        if (payload.expiresAt.getTime() <= Date.now()) {
            return "Expiration must be a valid future date and time.";
        }
    }

    return null;
}

export async function generateShortId(req: Request, res: Response) {
    try {
        if (
            !isSafePlainInput(req.body.url) ||
            (req.body.customShortId !== undefined && !isSafePlainInput(req.body.customShortId)) ||
            (req.body.expiresAt !== undefined && !isSafePlainInput(req.body.expiresAt)) ||
            (req.body.expiresOn !== undefined && !isSafePlainInput(req.body.expiresOn)) ||
            (req.body.expiresAtTime !== undefined && !isSafePlainInput(req.body.expiresAtTime))
        ) {
            if (isJsonRequest(req)) {
                return res.status(400).json({
                    error: "Invalid URL input."
                });
            }

            return renderHomeWithState(
                req,
                res,
                {
                    error: "Invalid URL input.",
                    values: {}
                },
                400
            );
        }

        const payload = normalizeCreatePayload(req.body);
        const payloadError = validateCreatePayload(payload);
        if (payloadError) {
            if (isJsonRequest(req)) {
                return res.status(400).json({
                    error: payloadError
                });
            }

            return renderHomeWithState(
                req,
                res,
                {
                    error: payloadError,
                    values: {
                        url: payload.url,
                        customShortId: payload.customShortId,
                        expiresAt: payload.expiresAtInput,
                        expiresOn: payload.expiresOnInput,
                        expiresAtTime: payload.expiresAtTimeInput
                    }
                },
                400
            );
        }

        const ownerId = getOwnerId(req);
        let urlEntry = ownerId
            ? await URL.findOne({ redirectUrl: payload.url, createdBy: ownerId })
            : null;

        if (urlEntry) {
            if (payload.customShortId && urlEntry.shortId !== payload.customShortId) {
                if (isJsonRequest(req)) {
                    return res.status(409).json({
                        error: `This URL already exists with short ID "${urlEntry.shortId}".`,
                        url: buildUrlResponse(req, urlEntry)
                    });
                }

                return renderHomeWithState(
                    req,
                    res,
                    {
                        error: `This URL already exists with short ID "${urlEntry.shortId}".`,
                        values: buildFormValues(payload),
                        url: buildShortUrl(req, urlEntry.shortId)
                    },
                    409
                );
            }

            if (isJsonRequest(req)) {
                return res.status(200).json({
                    message: "Short URL already exists for this destination.",
                    url: buildUrlResponse(req, urlEntry)
                });
            }

            return renderHomeWithState(req, res, {
                url: buildShortUrl(req, urlEntry.shortId),
                values: buildEditableValues(urlEntry)
            });
        }

        const shortId = payload.customShortId || nanoid(8);
        const existingShortId = await URL.findOne({ shortId });
        if (existingShortId) {
            const conflict = await buildAliasConflict(req, shortId);
            if (isJsonRequest(req)) {
                return res.status(409).json(conflict);
            }

            return renderHomeWithState(
                req,
                res,
                {
                    error: conflict.error,
                    values: {
                        ...buildFormValues(payload),
                        customShortId: conflict.suggestedAlias
                    }
                },
                409
            );
        }

        urlEntry = await URL.create({
            shortId,
            redirectUrl: payload.url,
            expiresAt: payload.expiresAt,
            createdBy: ownerId ?? undefined
        });

        if (isJsonRequest(req)) {
            return res.status(201).json({
                message: payload.expiresAt
                    ? "Short URL created with expiration."
                    : "Short URL created.",
                url: buildUrlResponse(req, urlEntry)
            });
        }

        return renderHomeWithState(req, res, {
            successMessage: payload.expiresAt
                ? "Short URL created with expiration."
                : "Short URL created.",
            url: buildShortUrl(req, urlEntry.shortId),
            values: buildEditableValues(urlEntry)
        });
    } catch (err: unknown) {
        if (isDuplicateKeyError(err)) {
            const payload = normalizeCreatePayload(req.body);
            const ownerId = getOwnerId(req);
            const existingUrl = ownerId
                ? await URL.findOne({ redirectUrl: payload.url, createdBy: ownerId })
                : null;

            if (existingUrl) {
                if (isJsonRequest(req)) {
                    return res
                        .status(
                            payload.customShortId && existingUrl.shortId !== payload.customShortId
                                ? 409
                                : 200
                        )
                        .json({
                            error:
                                payload.customShortId &&
                                existingUrl.shortId !== payload.customShortId
                                    ? `This URL already exists with short ID "${existingUrl.shortId}".`
                                    : null,
                            url: buildUrlResponse(req, existingUrl)
                        });
                }

                return renderHomeWithState(req, res, {
                    error:
                        payload.customShortId && existingUrl.shortId !== payload.customShortId
                            ? `This URL already exists with short ID "${existingUrl.shortId}".`
                            : null,
                    url: buildShortUrl(req, existingUrl.shortId),
                    values: buildEditableValues(existingUrl)
                });
            }

            if (payload.customShortId) {
                const conflict = await buildAliasConflict(req, payload.customShortId);
                if (isJsonRequest(req)) {
                    return res.status(409).json(conflict);
                }

                return renderHomeWithState(
                    req,
                    res,
                    {
                        error: conflict.error,
                        values: {
                            ...buildFormValues(payload),
                            customShortId: conflict.suggestedAlias
                        }
                    },
                    409
                );
            }
        }

        throw err;
    }
}

export async function updateShortUrl(req: Request, res: Response) {
    const currentShortId = normalizeShortIdInput(req.params.shortId);
    if (!isValidShortId(currentShortId)) {
        if (isJsonRequest(req)) {
            return res.status(400).json({
                error: "Invalid short URL."
            });
        }

        return renderHomeWithState(
            req,
            res,
            {
                error: "Invalid short URL."
            },
            400
        );
    }

    const payload = normalizeCreatePayload(req.body);
    if (!payload.customShortId) {
        payload.customShortId = currentShortId;
    }

    const payloadError = validateCreatePayload(payload);
    if (payloadError) {
        if (isJsonRequest(req)) {
            return res.status(400).json({
                error: payloadError
            });
        }

        return renderHomeWithState(
            req,
            res,
            {
                error: payloadError,
                values: buildFormValues(payload)
            },
            400
        );
    }

    const existingEntry = await URL.findOne(buildOwnerFilter(currentShortId, req));
    if (!existingEntry) {
        if (isJsonRequest(req)) {
            return res.status(404).json({
                error: "Short URL not found."
            });
        }

        return renderHomeWithState(
            req,
            res,
            {
                error: "Short URL not found."
            },
            404
        );
    }

    const duplicateAlias = await URL.findOne({
        shortId: payload.customShortId,
        _id: mongoose.trusted({ $ne: existingEntry._id })
    });
    if (duplicateAlias) {
        const conflict = await buildAliasConflict(req, payload.customShortId);
        if (isJsonRequest(req)) {
            return res.status(409).json(conflict);
        }

        return renderHomeWithState(
            req,
            res,
            {
                error: conflict.error,
                values: {
                    ...buildFormValues(payload),
                    customShortId: conflict.suggestedAlias
                }
            },
            409
        );
    }

    existingEntry.shortId = payload.customShortId;
    existingEntry.redirectUrl = payload.url;
    existingEntry.expiresAt = payload.expiresAt;
    existingEntry.lastEditedAt = new Date();
    await existingEntry.save();

    if (isJsonRequest(req)) {
        return res.status(200).json({
            message: "Short URL updated successfully.",
            url: buildUrlResponse(req, existingEntry)
        });
    }

    return renderHomeWithState(req, res, {
        successMessage: "Short URL updated successfully.",
        url: buildShortUrl(req, existingEntry.shortId),
        values: buildEditableValues(existingEntry)
    });
}

export async function deleteShortUrl(req: Request, res: Response) {
    const shortId = normalizeShortIdInput(req.params.shortId);
    if (!isValidShortId(shortId)) {
        if (isJsonRequest(req)) {
            return res.status(400).json({
                error: "Invalid short URL."
            });
        }

        return renderHomeWithState(
            req,
            res,
            {
                error: "Invalid short URL."
            },
            400
        );
    }

    const deletedEntry = await URL.findOneAndDelete(buildOwnerFilter(shortId, req));
    if (!deletedEntry) {
        if (isJsonRequest(req)) {
            return res.status(404).json({
                error: "Short URL not found."
            });
        }

        return renderHomeWithState(
            req,
            res,
            {
                error: "Short URL not found."
            },
            404
        );
    }

    await deleteVisitsForUrl(deletedEntry._id);

    if (isJsonRequest(req)) {
        return res.status(200).json({
            message: "Short URL deleted successfully."
        });
    }

    return renderHomeWithState(req, res, {
        successMessage: "Short URL deleted successfully."
    });
}

export async function moderateShortUrl(req: Request, res: Response) {
    const shortId = normalizeShortIdInput(req.params.shortId);
    const action = normalizeShortIdInput(req.body.action || "");
    const disabledReason = normalizeUrlInput(req.body.disabledReason || "");

    if (!req.user?.isAdmin) {
        if (isJsonRequest(req)) {
            return res.status(403).json({
                error: "Admin access required."
            });
        }

        return res.status(403).render("login", {
            error: "Admin access required."
        });
    }

    const entry = await URL.findOne({ shortId });
    if (!entry) {
        if (isJsonRequest(req)) {
            return res.status(404).json({
                error: "Short URL not found."
            });
        }

        return res.status(404).redirect("/profile");
    }

    if (action === "disable") {
        entry.isDisabled = true;
        entry.disabledReason = disabledReason || "Disabled by admin.";
    } else {
        entry.isDisabled = false;
        entry.disabledReason = null;
    }

    await entry.save();

    if (isJsonRequest(req)) {
        return res.status(200).json({
            message: entry.isDisabled ? "Short URL disabled." : "Short URL enabled.",
            url: buildUrlResponse(req, entry)
        });
    }

    return res.redirect("/profile");
}

export async function redirectToShortURL(req: Request, res: Response) {
    const shortId = normalizeUrlInput(req.params.shortId);
    if (!isValidShortId(shortId)) {
        return res.status(400).json({
            error: "Invalid short URL."
        });
    }

    const entry = await URL.findOne({ shortId });

    if (!entry) {
        return res.status(404).json({
            error: "Short URL not found"
        });
    }

    if (entry.isDisabled) {
        return res.status(403).json({
            error: entry.disabledReason || "Short URL has been disabled."
        });
    }

    if (isExpired(entry)) {
        return res.status(410).json({
            error: "Short URL has expired."
        });
    }

    recordVisit(entry._id, {
        timestamp: Date.now(),
        country: getVisitorCountry(req),
        isBot: isBotRequest(req),
        userAgent: req.get("user-agent") || null
    }).catch((error) => {
        logError(error, {
            source: "redirect-analytics",
            details: { shortId }
        });
    });

    return res.redirect(entry.redirectUrl);
}

export async function getShortURLAnalytics(req: Request, res: Response) {
    const shortId = normalizeUrlInput(req.params.shortId);
    if (!isValidShortId(shortId)) {
        return res.status(400).json({
            error: "Invalid short URL."
        });
    }

    if (!req.user) {
        return res.status(401).json({ error: "Authentication required." });
    }

    const entry = await URL.findOne({ shortId, createdBy: req.user._id });
    if (!entry) {
        return res.status(404).json({
            error: "Short URL not found"
        });
    }

    const analytics = await getUrlAnalytics(entry);

    return res.json({
        shortId,
        redirectUrl: entry.redirectUrl,
        shortUrl: buildShortUrl(req, shortId),
        count: analytics.humanVisits,
        totalVisitsIncludingBots: analytics.totalVisits,
        botVisits: analytics.botVisits,
        status: getUrlStatus(entry),
        expiresAt: entry.expiresAt,
        visitHistory: analytics.visitHistory
    });
}
