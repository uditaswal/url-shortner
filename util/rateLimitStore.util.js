import mongoose from "mongoose";
import RateLimitEntry from "../model/rateLimitEntry.models.js";

export default class MongoRateLimitStore {
    constructor(prefix = "rate-limit") {
        this.prefix = prefix;
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
        const now = new Date();
        const nextResetTime = new Date(now.getTime() + this.windowMs);

        let entry = await RateLimitEntry.findOneAndUpdate(
            {
                key: scopedKey,
                resetTime: mongoose.trusted({ $gt: now })
            },
            {
                $inc: { totalHits: 1 }
            },
            {
                returnDocument: "after"
            }
        );

        if (!entry) {
            entry = await RateLimitEntry.findOneAndUpdate(
                { key: scopedKey },
                {
                    $set: {
                        totalHits: 1,
                        resetTime: nextResetTime
                    }
                },
                {
                    upsert: true,
                    returnDocument: "after",
                    setDefaultsOnInsert: true
                }
            );
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
