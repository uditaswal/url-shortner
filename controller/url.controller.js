import URL from "../model/url.models.js";
import { nanoid } from 'nanoid';
import { isSafePlainInput, isValidShortId, normalizeUrlInput, validateHttpUrl } from "../util/validation.util.js";

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

function getOwnerId(req) {
    return req.user?._id || null;
}

async function renderHomeWithState(req, res, extras = {}, statusCode = 200) {
    const userUrls = req.user
        ? await URL.find({ createdBy: req.user._id }).sort({ createdAt: -1 })
        : [];

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
        url: extras.url || null
    });
}

export async function generateShortId(req, res) {
    try {
        if (!isSafePlainInput(req.body.url)) {
            return renderHomeWithState(req, res, {
                error: "Invalid URL input.",
                values: {}
            }, 400);
        }

        const url = normalizeUrlInput(req.body.url);
        if (!url) {
            return renderHomeWithState(req, res, {
                error: "URL is required.",
                values: { url }
            }, 400);
        }

        if (!validateHttpUrl(url)) {
            return renderHomeWithState(req, res, {
                error: "Enter a valid URL starting with http:// or https://.",
                values: { url }
            }, 400);
        }

        const ownerId = getOwnerId(req);
        let urlEntry = await URL.findOne({ redirectUrl: url, createdBy: ownerId });

        if (!urlEntry) {
            const shortId = nanoid(8);
            urlEntry = await URL.create({
                shortId,
                redirectUrl: url,
                visitHistory: [],
                createdBy: ownerId,
            });
        }

        console.log("Short Id resolved from DB:", urlEntry);
        return renderHomeWithState(req, res, {
            url: buildShortUrl(req, urlEntry.shortId)
        });
    } catch (err) {
        if (err?.code === 11000) {
            const normalizedUrl = normalizeUrlInput(req.body.url);
            const existingUrl = await URL.findOne({
                redirectUrl: normalizedUrl,
                createdBy: getOwnerId(req)
            });

            if (existingUrl) {
                return renderHomeWithState(req, res, {
                    url: buildShortUrl(req, existingUrl.shortId)
                });
            }
        }

        throw err;
    }
};

export async function redirectToShortURL(req, res) {
    try {
        const shortId = normalizeUrlInput(req.params.shortId);
        if (!isValidShortId(shortId)) {
            return res.status(400).json({
                error: "Invalid short URL."
            });
        }

        const entry = await URL.findOne({ shortId })

        if (!entry) {
            return res.status(404).json({
                error: "Short URL not found"
            });
        }

        await URL.findOneAndUpdate({ shortId, },
            {
                $push: {
                    visitHistory: {
                        timestamp: Date.now(),
                        country: getVisitorCountry(req)
                    }
                },

            }
        )
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

        const entry = await URL.findOne({ shortId, createdBy: req.user._id })
        if (!entry) {
            return res.status(404).json({
                error: "Short URL not found"
            });
        }
        return res.json({
            shortId: shortId,
            redirectUrl: entry.redirectUrl,
            shortUrl: `http://localhost:3000/${shortId}`,
            count: entry.visitHistory.length,
            visitHistory: entry.visitHistory

        })
    }
    catch (err) {
        throw err;
    }



}
