import RateLimitEntry from "../model/rateLimitEntry.models.js";

export default class MongoRateLimitStore {
    constructor(prefix = "rate-limit", now = () => new Date()) {
        this.prefix = prefix;
        this.now = now;
        this.windowMs = 60 * 1000;
    }

    init(options) {
        this.windowMs = options.windowMs;
    }

    buildKey(key) {
        return `${this.prefix}:${key}`;
    }

    async get(key) {
        const entry = await RateLimitEntry.findOne({ key: this.buildKey(key) }).lean();
        if (!entry) {
            return undefined;
        }

        return {
            totalHits: entry.totalHits,
            resetTime: entry.resetTime
        };
    }

    async increment(key) {
        const scopedKey = this.buildKey(key);
        const now = this.now();
        const nextResetTime = new Date(now.getTime() + this.windowMs);
        const update = [
            {
                $set: {
                    totalHits: {
                        $cond: [
                            { $gt: ["$resetTime", now] },
                            { $add: [{ $ifNull: ["$totalHits", 0] }, 1] },
                            1
                        ]
                    },
                    resetTime: {
                        $cond: [{ $gt: ["$resetTime", now] }, "$resetTime", nextResetTime]
                    }
                }
            }
        ];

        let entry;
        try {
            entry = await RateLimitEntry.findOneAndUpdate({ key: scopedKey }, update, {
                upsert: true,
                updatePipeline: true,
                returnDocument: "after"
            });
        } catch (error) {
            if (error?.code !== 11000) throw error;
            entry = await RateLimitEntry.findOneAndUpdate({ key: scopedKey }, update, {
                updatePipeline: true,
                returnDocument: "after"
            });
        }

        return {
            totalHits: entry.totalHits,
            resetTime: entry.resetTime
        };
    }

    async decrement(key) {
        await RateLimitEntry.findOneAndUpdate(
            { key: this.buildKey(key), totalHits: { $gt: 0 } },
            { $inc: { totalHits: -1 } }
        );
    }

    async resetKey(key) {
        await RateLimitEntry.deleteOne({ key: this.buildKey(key) });
    }

    async resetAll() {
        await RateLimitEntry.deleteMany({
            key: { $regex: `^${this.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:` }
        });
    }
}
