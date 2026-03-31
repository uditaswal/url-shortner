import express from 'express';
import URL from "../model/url.models.js";
import logger from "../util/logger.util.js"

const staticRouter = express.Router();

function getDashboardState(query = {}) {
    const search = typeof query.search === "string" ? query.search.trim().toLowerCase() : "";
    const status = ["all", "active", "inactive"].includes(query.status) ? query.status : "all";
    const sortBy = ["createdAt", "clicks", "shortId", "redirectUrl"].includes(query.sortBy) ? query.sortBy : "createdAt";
    const order = query.order === "asc" ? "asc" : "desc";

    return { search, status, sortBy, order };
}

function applyDashboardFilters(urls, filters) {
    let items = [...urls];

    if (filters.search) {
        items = items.filter((item) =>
            item.shortId?.toLowerCase().includes(filters.search) ||
            item.redirectUrl?.toLowerCase().includes(filters.search)
        );
    }

    if (filters.status === "active") {
        items = items.filter((item) => (item.visitHistory?.length || 0) > 0);
    }

    if (filters.status === "inactive") {
        items = items.filter((item) => (item.visitHistory?.length || 0) === 0);
    }

    items.sort((a, b) => {
        let left;
        let right;

        if (filters.sortBy === "clicks") {
            left = a.visitHistory?.length || 0;
            right = b.visitHistory?.length || 0;
        } else if (filters.sortBy === "createdAt") {
            left = new Date(a.createdAt).getTime();
            right = new Date(b.createdAt).getTime();
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
        ? await URL.find({ createdBy: req.user._id }).sort({ createdAt: -1 })
        : [];

    const filteredUrls = req.user ? applyDashboardFilters(allUsers, filters) : [];

    return res.render('home', {
        urls: filteredUrls,
        isGuestMode: !req.user,
        dashboardFilters: filters
    });

})

staticRouter.route("/profile").get(async (req, res) => {

    if (!req.user) return res.redirect("/login");

    const userUrls = await URL.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    const totalUrls = userUrls.length;
    const totalClicks = userUrls.reduce((sum, item) => sum + (item.visitHistory?.length || 0), 0);
    const activeUrls = userUrls.filter((item) => (item.visitHistory?.length || 0) > 0).length;
    const countryStatsMap = new Map();

    userUrls.forEach((url) => {
        (url.visitHistory || []).forEach((visit) => {
            const country = visit.country || "Unknown";
            countryStatsMap.set(country, (countryStatsMap.get(country) || 0) + 1);
        });
    });

    const countryStats = Array.from(countryStatsMap.entries())
        .map(([country, clicks]) => ({ country, clicks }))
        .sort((a, b) => b.clicks - a.clicks);

    return res.render("profile", {
        stats: {
            totalUrls,
            totalClicks,
            activeUrls,
        },
        urls: userUrls,
        countryStats,
    });
});

staticRouter.route("/login").get((req, res) => {
    if (req.user) return res.redirect("/");

    return res.render('login')
})


export default staticRouter;
