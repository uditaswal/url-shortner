import RateLimitEntry from "../model/rateLimitEntry.models.js";
import type { Options, Store } from "express-rate-limit";

function isDuplicateKeyError(error: unknown): error is { code: number } {
    return typeof error === "object" && error !== null && "code" in error && error.code === 11000;
}

export default class MongoRateLimitStore implements Store {
    prefix: string;
    now: () => Date;
    windowMs: number;

    constructor(prefix = "rate-limit", now = () => new Date()) {
        this.prefix = prefix;
        this.now = now;
        this.windowMs = 60 * 1000;
    }

    init(options: Pick<Options, "windowMs">): void {
        this.windowMs = options.windowMs;
    }

    buildKey(key: string): string {
        return `${this.prefix}:${key}`;
    }

    async get(key: string) {
        const entry = await RateLimitEntry.findOne({ key: this.buildKey(key) }).lean();
        if (!entry) {
            return undefined;
        }

        return {
            totalHits: entry.totalHits,
            resetTime: entry.resetTime
        };
    }

    async increment(key: string) {
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
            if (!isDuplicateKeyError(error)) throw error;
            entry = await RateLimitEntry.findOneAndUpdate({ key: scopedKey }, update, {
                updatePipeline: true,
                returnDocument: "after"
            });
        }

        if (!entry) throw new Error("Unable to increment rate-limit counter.");

        return {
            totalHits: entry.totalHits,
            resetTime: entry.resetTime
        };
    }

    async decrement(key: string): Promise<void> {
        await RateLimitEntry.findOneAndUpdate(
            { key: this.buildKey(key), totalHits: { $gt: 0 } },
            { $inc: { totalHits: -1 } }
        );
    }

    async resetKey(key: string): Promise<void> {
        await RateLimitEntry.deleteOne({ key: this.buildKey(key) });
    }

    async resetAll(): Promise<void> {
        await RateLimitEntry.deleteMany({
            key: { $regex: `^${this.prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:` }
        });
    }
}
