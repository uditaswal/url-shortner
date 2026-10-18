import Visit from "../model/visit.models.js";

function legacyVisits(entry) {
    return Array.isArray(entry?.visitHistory) ? entry.visitHistory : [];
}

function legacyCounts(entry) {
    const visits = legacyVisits(entry);
    const botVisits = visits.filter((visit) => visit.isBot).length;

    return {
        humanVisits: visits.length - botVisits,
        botVisits
    };
}

function publicVisit(visit) {
    return {
        timestamp: new Date(visit.timestamp).getTime(),
        country: visit.country || "Unknown",
        isBot: Boolean(visit.isBot),
        userAgent: visit.userAgent || null
    };
}

export function recordVisit(urlId, visit) {
    return Visit.create({
        urlId,
        timestamp: new Date(visit.timestamp),
        country: visit.country,
        isBot: visit.isBot,
        userAgent: visit.userAgent
    });
}

export async function attachVisitCounts(entries) {
    if (entries.length === 0) return [];

    const ids = entries.map((entry) => entry._id);
    const storedCounts = await Visit.aggregate([
        { $match: { urlId: { $in: ids } } },
        {
            $group: {
                _id: "$urlId",
                humanVisits: { $sum: { $cond: ["$isBot", 0, 1] } },
                botVisits: { $sum: { $cond: ["$isBot", 1, 0] } }
            }
        }
    ]);
    const countsByUrl = new Map(storedCounts.map((item) => [String(item._id), item]));

    return entries.map((entry) => {
        const plain = typeof entry.toObject === "function" ? entry.toObject() : entry;
        const legacy = legacyCounts(plain);
        const stored = countsByUrl.get(String(plain._id));

        return {
            ...plain,
            visitCount: legacy.humanVisits + (stored?.humanVisits || 0),
            botVisitCount: legacy.botVisits + (stored?.botVisits || 0)
        };
    });
}

export async function getCountryStats(entries) {
    if (entries.length === 0) return [];

    const ids = entries.map((entry) => entry._id);
    const storedCountries = await Visit.aggregate([
        { $match: { urlId: { $in: ids }, isBot: false } },
        { $group: { _id: "$country", clicks: { $sum: 1 } } }
    ]);
    const totals = new Map(
        storedCountries.map((item) => [item._id || "Unknown", item.clicks])
    );

    entries.forEach((entry) => {
        legacyVisits(entry).forEach((visit) => {
            if (visit.isBot) return;
            const country = visit.country || "Unknown";
            totals.set(country, (totals.get(country) || 0) + 1);
        });
    });

    return Array.from(totals.entries())
        .map(([country, clicks]) => ({ country, clicks }))
        .sort((a, b) => b.clicks - a.clicks);
}

export async function getUrlAnalytics(entry, historyLimit = 500) {
    const [humanVisits, botVisits, recentVisits] = await Promise.all([
        Visit.countDocuments({ urlId: entry._id, isBot: false }),
        Visit.countDocuments({ urlId: entry._id, isBot: true }),
        Visit.find({ urlId: entry._id }).sort({ timestamp: -1 }).limit(historyLimit).lean()
    ]);
    const legacy = legacyCounts(entry);
    const legacyHistory = legacyVisits(entry).map((visit) =>
        typeof visit.toObject === "function" ? visit.toObject() : visit
    );

    return {
        humanVisits: humanVisits + legacy.humanVisits,
        botVisits: botVisits + legacy.botVisits,
        totalVisits: humanVisits + botVisits + legacy.humanVisits + legacy.botVisits,
        visitHistory: [...recentVisits, ...legacyHistory]
            .map(publicVisit)
            .sort(
                (left, right) =>
                    new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
            )
            .slice(0, historyLimit)
    };
}

export function deleteVisitsForUrl(urlId) {
    return Visit.deleteMany({ urlId });
}
