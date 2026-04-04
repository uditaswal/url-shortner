import mongoose from "mongoose";
import URL from "../model/url.models.js";
import { nanoid } from "nanoid";
import {
    isSafePlainInput,
    isValidShortId,
    normalizeDateTimeInput,
    normalizeShortIdInput,
    normalizeUrlInput,
    parseExpirationInput,
    validateHttpUrl
} from "../util/validation.util.js";

function buildShortUrl(req, shortId) {
    return `${req.protocol}://${req.get("host")}/${shortId}`;
}

function getVisitorCountry(req) {
    const country =
        req.get("cf-ipcountry") ||
        req.get("x-vercel-ip-country") ||
        req.get("cloudfront-viewer-country") ||
        req.headers["x-country-code"];

    if (!country || country === "XX" || country === "T1") {
        return "Unknown";
    }

    return String(country).toUpperCase();
}

function isBotRequest(req) {
    const userAgent = req.get("user-agent") || "";
    return /(bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|discord|telegram|linkedinbot)/i.test(userAgent);
}

function isExpired(entry) {
    return Boolean(entry?.expiresAt && new Date(entry.expiresAt).getTime() <= Date.now());
}

function getUrlStatus(entry) {
    if (entry?.isDisabled) {
        return "disabled";
    }

    if (isExpired(entry)) {
        return "expired";
    }

    return "active";
}

function getOwnerId(req) {
    return req.user?._id || null;
}

function buildEditableValues(entry) {
    const expirationDate = entry?.expiresAt ? new Date(entry.expiresAt) : null;

    return {
        url: entry?.redirectUrl || "",
        customShortId: entry?.shortId || "",
        expiresAt: expirationDate ? expirationDate.toISOString().slice(0, 16) : "",
        expiresOn: expirationDate ? expirationDate.toISOString().slice(0, 10) : "",
        expiresAtTime: expirationDate
            ? expirationDate.toISOString().slice(11, 16)
            : ""
    };
}

function buildOwnerFilter(shortId, req) {
    return req.user?.isAdmin
        ? { shortId }
        : { shortId, createdBy: req.user?._id };
}

async function loadDashboardUrls(req) {
    if (!req.user) {
        return [];
    }

    const urls = await URL.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    return urls.map((item) => ({
        ...item.toObject(),
        statusLabel: getUrlStatus(item)
    }));
}

async function renderHomeWithState(req, res, extras = {}, statusCode = 200) {
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

function normalizeCreatePayload(body = {}) {
    const expiresOnInput = normalizeDateTimeInput(body.expiresOn || "");
    const expiresAtTimeInput = normalizeDateTimeInput(body.expiresAtTime || "");
    const legacyExpiresAtInput = normalizeDateTimeInput(body.expiresAt || "");
    const hasSplitExpirationInput = Boolean(expiresOnInput || expiresAtTimeInput);

    const today = new Date();
    const todayDateInput = today.toISOString().slice(0, 10);
    const resolvedExpiresOnInput = expiresOnInput || (expiresAtTimeInput ? todayDateInput : "");
    const resolvedExpiresAtTimeInput = expiresAtTimeInput || (expiresOnInput ? "00:00" : "");
    const expiresAtInput = hasSplitExpirationInput
        ? [resolvedExpiresOnInput, resolvedExpiresAtTimeInput].filter(Boolean).join(" ")
        : legacyExpiresAtInput;

    let expiresAt = null;
    if (hasSplitExpirationInput && resolvedExpiresOnInput && resolvedExpiresAtTimeInput) {
        expiresAt = parseExpirationInput(`${resolvedExpiresOnInput}T${resolvedExpiresAtTimeInput}`);
    } else if (!hasSplitExpirationInput) {
        expiresAt = parseExpirationInput(legacyExpiresAtInput);
    }

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
        usedDefaultDate: Boolean(!expiresOnInput && expiresAtTimeInput),
        usedDefaultTime: Boolean(expiresOnInput && !expiresAtTimeInput)
    };
}

function validateCreatePayload(payload) {
    if (!payload.url) {
        return "URL is required.";
    }

    if (!validateHttpUrl(payload.url)) {
        return "Enter a valid URL starting with http:// or https://.";
    }

    if (payload.customShortId && !isValidShortId(payload.customShortId)) {
        return "Short ID must be 6 to 20 characters and can only use letters, numbers, hyphens, or underscores.";
    }

    if (payload.usedDefaultDate) {
        const currentTime = new Date();
        const currentTimeValue = `${String(currentTime.getHours()).padStart(2, "0")}:${String(currentTime.getMinutes()).padStart(2, "0")}`;
        if (payload.expiresAtTimeInput > currentTimeValue) {
            return "When only time is entered, it cannot be later than the current system time.";
        }
    }

    if (payload.expiresAtInput && (!payload.expiresAt || payload.expiresAt.getTime() <= Date.now())) {
        return "Expiration must be a valid future date and time.";
    }

    return null;
}

export async function generateShortId(req, res) {
    try {
        if (
            !isSafePlainInput(req.body.url) ||
            (req.body.customShortId !== undefined && !isSafePlainInput(req.body.customShortId)) ||
            (req.body.expiresAt !== undefined && !isSafePlainInput(req.body.expiresAt)) ||
            (req.body.expiresOn !== undefined && !isSafePlainInput(req.body.expiresOn)) ||
            (req.body.expiresAtTime !== undefined && !isSafePlainInput(req.body.expiresAtTime))
        ) {
            return renderHomeWithState(req, res, {
                error: "Invalid URL input.",
                values: {}
            }, 400);
        }

        const payload = normalizeCreatePayload(req.body);
        const payloadError = validateCreatePayload(payload);
        if (payloadError) {
            return renderHomeWithState(req, res, {
                error: payloadError,
                values: {
                    url: payload.url,
                    customShortId: payload.customShortId,
                    expiresAt: payload.expiresAtInput,
                    expiresOn: payload.expiresOnInput,
                    expiresAtTime: payload.expiresAtTimeInput
                }
            }, 400);
        }

        const ownerId = getOwnerId(req);
        let urlEntry = await URL.findOne({ redirectUrl: payload.url, createdBy: ownerId });

        if (urlEntry) {
            if (payload.customShortId && urlEntry.shortId !== payload.customShortId) {
                return renderHomeWithState(req, res, {
                    error: `This URL already exists with short ID "${urlEntry.shortId}".`,
                    values: payload,
                    url: buildShortUrl(req, urlEntry.shortId)
                }, 409);
            }

            return renderHomeWithState(req, res, {
                url: buildShortUrl(req, urlEntry.shortId),
                values: buildEditableValues(urlEntry)
            });
        }

        const shortId = payload.customShortId || nanoid(8);
        const existingShortId = await URL.findOne({ shortId });
        if (existingShortId) {
            return renderHomeWithState(req, res, {
                error: "That custom short ID is already taken. Try another one.",
                values: payload
            }, 409);
        }

        urlEntry = await URL.create({
            shortId,
            redirectUrl: payload.url,
            expiresAt: payload.expiresAt,
            visitHistory: [],
            createdBy: ownerId,
        });

        return renderHomeWithState(req, res, {
            successMessage: payload.expiresAt ? "Short URL created with expiration." : "Short URL created.",
            url: buildShortUrl(req, urlEntry.shortId),
            values: buildEditableValues(urlEntry)
        });
    } catch (err) {
        if (err?.code === 11000) {
            const payload = normalizeCreatePayload(req.body);
            const existingUrl = await URL.findOne({
                redirectUrl: payload.url,
                createdBy: getOwnerId(req)
            });

            if (existingUrl) {
                return renderHomeWithState(req, res, {
                    error: payload.customShortId && existingUrl.shortId !== payload.customShortId
                        ? `This URL already exists with short ID "${existingUrl.shortId}".`
                        : null,
                    url: buildShortUrl(req, existingUrl.shortId),
                    values: buildEditableValues(existingUrl)
                });
            }

            if (payload.customShortId) {
                return renderHomeWithState(req, res, {
                    error: "That custom short ID is already taken. Try another one.",
                    values: payload
                }, 409);
            }
        }

        throw err;
    }
}

export async function updateShortUrl(req, res) {
    const currentShortId = normalizeShortIdInput(req.params.shortId);
    if (!isValidShortId(currentShortId)) {
        return renderHomeWithState(req, res, {
            error: "Invalid short URL."
        }, 400);
    }

    const payload = normalizeCreatePayload(req.body);
    if (!payload.customShortId) {
        payload.customShortId = currentShortId;
    }

    const payloadError = validateCreatePayload(payload);
    if (payloadError) {
        return renderHomeWithState(req, res, {
            error: payloadError,
            values: payload
        }, 400);
    }

    const existingEntry = await URL.findOne(buildOwnerFilter(currentShortId, req));
    if (!existingEntry) {
        return renderHomeWithState(req, res, {
            error: "Short URL not found."
        }, 404);
    }

    const duplicateAlias = await URL.findOne({
        shortId: payload.customShortId,
        _id: mongoose.trusted({ $ne: existingEntry._id })
    });
    if (duplicateAlias) {
        return renderHomeWithState(req, res, {
            error: "That short ID is already taken. Try another one.",
            values: payload
        }, 409);
    }

    existingEntry.shortId = payload.customShortId;
    existingEntry.redirectUrl = payload.url;
    existingEntry.expiresAt = payload.expiresAt;
    existingEntry.lastEditedAt = new Date();
    await existingEntry.save();

    return renderHomeWithState(req, res, {
        successMessage: "Short URL updated successfully.",
        url: buildShortUrl(req, existingEntry.shortId),
        values: buildEditableValues(existingEntry)
    });
}

export async function deleteShortUrl(req, res) {
    const shortId = normalizeShortIdInput(req.params.shortId);
    if (!isValidShortId(shortId)) {
        return renderHomeWithState(req, res, {
            error: "Invalid short URL."
        }, 400);
    }

    const deletedEntry = await URL.findOneAndDelete(buildOwnerFilter(shortId, req));
    if (!deletedEntry) {
        return renderHomeWithState(req, res, {
            error: "Short URL not found."
        }, 404);
    }

    return renderHomeWithState(req, res, {
        successMessage: "Short URL deleted successfully."
    });
}

export async function moderateShortUrl(req, res) {
    const shortId = normalizeShortIdInput(req.params.shortId);
    const action = normalizeShortIdInput(req.body.action || "");
    const disabledReason = normalizeUrlInput(req.body.disabledReason || "");

    if (!req.user?.isAdmin) {
        return res.status(403).render("login", {
            error: "Admin access required."
        });
    }

    const entry = await URL.findOne({ shortId });
    if (!entry) {
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
    return res.redirect("/profile");
}

export async function redirectToShortURL(req, res) {
    try {
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

        await URL.findOneAndUpdate(
            { shortId },
            {
                $push: {
                    visitHistory: {
                        timestamp: Date.now(),
                        country: getVisitorCountry(req),
                        isBot: isBotRequest(req),
                        userAgent: req.get("user-agent") || null
                    }
                },
            }
        );

        return res.redirect(entry.redirectUrl);
    } catch (err) {
        throw err;
    }
}

export async function getShortURLAnalytics(req, res) {
    try {
        const shortId = normalizeUrlInput(req.params.shortId);
        if (!isValidShortId(shortId)) {
            return res.status(400).json({
                error: "Invalid short URL."
            });
        }

        const entry = await URL.findOne({ shortId, createdBy: req.user._id });
        if (!entry) {
            return res.status(404).json({
                error: "Short URL not found"
            });
        }

        const botVisits = entry.visitHistory.filter((visit) => visit.isBot).length;
        const nonBotVisits = entry.visitHistory.length - botVisits;

        return res.json({
            shortId,
            redirectUrl: entry.redirectUrl,
            shortUrl: buildShortUrl(req, shortId),
            count: nonBotVisits,
            totalVisitsIncludingBots: entry.visitHistory.length,
            botVisits,
            status: getUrlStatus(entry),
            expiresAt: entry.expiresAt,
            visitHistory: entry.visitHistory
        });
    } catch (err) {
        throw err;
    }
}
