import express from "express";
import mongoose from "mongoose";
import URL from "../model/url.models.js";
import logger from "../util/logger.util.js";

const staticRouter = express.Router();

function getDashboardState(query = {}) {
    const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
    const status = ["all", "active", "inactive", "expired", "disabled"].includes(query.status) ? query.status : "all";
    const sortBy = ["createdAt", "clicks", "shortId", "redirectUrl", "expiresAt"].includes(query.sortBy) ? query.sortBy : "createdAt";
    const order = query.order === "asc" ? "asc" : "desc";

    return { search, status, sortBy, order };
}

function getUrlStatus(item) {
    if (item.isDisabled) {
        return "disabled";
    }

    if (item.expiresAt && new Date(item.expiresAt).getTime() <= Date.now()) {
        return "expired";
    }

    return "active";
}

function toDashboardItem(item) {
    const plain = typeof item.toObject === "function" ? item.toObject() : item;
    return {
        ...plain,
        statusLabel: getUrlStatus(plain)
    };
}

function applyDashboardFilters(urls, filters) {
    let items = [...urls];

    if (filters.search) {
        items = items.filter((item) =>
            item.shortId?.toLowerCase().includes(filters.search) ||
            item.redirectUrl?.toLowerCase().includes(filters.search)
        );
    }

    if (filters.status === "inactive") {
        items = items.filter((item) => item.statusLabel === "active" && ((item.visitHistory || []).filter((visit) => !visit.isBot).length === 0));
    } else if (filters.status !== "all") {
        items = items.filter((item) => item.statusLabel === filters.status);
    }

    items.sort((a, b) => {
        let left;
        let right;

        if (filters.sortBy === "clicks") {
            left = (a.visitHistory || []).filter((visit) => !visit.isBot).length;
            right = (b.visitHistory || []).filter((visit) => !visit.isBot).length;
        } else if (filters.sortBy === "createdAt" || filters.sortBy === "expiresAt") {
            left = a[filters.sortBy] ? new Date(a[filters.sortBy]).getTime() : 0;
            right = b[filters.sortBy] ? new Date(b[filters.sortBy]).getTime() : 0;
        } else {
            left = String(a[filters.sortBy] || "").toLowerCase();
            right = String(b[filters.sortBy] || "").toLowerCase();
        }

        if (left < right) return filters.order === "asc" ? -1 : 1;
        if (left > right) return filters.order === "asc" ? 1 : -1;
        return 0;
    });

    return items;
}

staticRouter.route("/").get(async (req, res) => {
    logger.info("Home route hit");
    const filters = getDashboardState(req.query);
    const allUsers = req.user
        ? (await URL.find({ createdBy: req.user._id }).sort({ createdAt: -1 })).map(toDashboardItem)
        : [];

    const filteredUrls = req.user ? applyDashboardFilters(allUsers, filters) : [];

    return res.render("home", {
        urls: filteredUrls,
        isGuestMode: !req.user,
        dashboardFilters: filters
    });
});

staticRouter.route("/profile").get(async (req, res) => {
    if (!req.user) return res.redirect("/login");

    const userUrls = (await URL.find({ createdBy: req.user._id }).sort({ createdAt: -1 })).map(toDashboardItem);
    const totalUrls = userUrls.length;
    const totalClicks = userUrls.reduce((sum, item) => sum + (item.visitHistory?.filter((visit) => !visit.isBot).length || 0), 0);
    const botFilteredClicks = userUrls.reduce((sum, item) => sum + (item.visitHistory?.filter((visit) => visit.isBot).length || 0), 0);
    const activeUrls = userUrls.filter((item) => item.statusLabel === "active").length;
    const countryStatsMap = new Map();

    userUrls.forEach((url) => {
        (url.visitHistory || []).forEach((visit) => {
            if (visit.isBot) {
                return;
            }

            const country = visit.country || "Unknown";
            countryStatsMap.set(country, (countryStatsMap.get(country) || 0) + 1);
        });
    });

    const countryStats = Array.from(countryStatsMap.entries())
        .map(([country, clicks]) => ({ country, clicks }))
        .sort((a, b) => b.clicks - a.clicks);

    const flaggedUrls = req.user.isAdmin
        ? (await URL.find({
            $or: [
                { isDisabled: true },
                {
                    expiresAt: mongoose.trusted({
                        $ne: null,
                        $lte: new Date()
                    })
                }
            ]
        }).sort({ updatedAt: -1 })).map(toDashboardItem)
        : [];

    return res.render("profile", {
        stats: {
            totalUrls,
            totalClicks,
            activeUrls,
            botFilteredClicks
        },
        urls: userUrls,
        countryStats,
        flaggedUrls,
    });
});

staticRouter.route("/login").get((req, res) => {
    if (req.user) return res.redirect("/");

    return res.render("login");
});

export default staticRouter;
