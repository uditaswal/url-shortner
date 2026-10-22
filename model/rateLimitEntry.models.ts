import mongoose from "mongoose";

export interface RateLimitEntryFields {
    key: string;
    totalHits: number;
    resetTime: Date;
    createdAt: Date;
    updatedAt: Date;
}

const rateLimitEntrySchema = new mongoose.Schema<RateLimitEntryFields>(
    {
        key: {
            type: String,
            required: true,
            unique: true
        },
        totalHits: {
            type: Number,
            required: true,
            default: 0
        },
        resetTime: {
            type: Date,
            required: true
        }
    },
    { timestamps: true }
);

rateLimitEntrySchema.index(
    { resetTime: 1 },
    { expireAfterSeconds: 0, name: "rate_limit_reset_ttl_idx" }
);

const RateLimitEntry = mongoose.model<RateLimitEntryFields>(
    "rate_limit_entry",
    rateLimitEntrySchema
);

export default RateLimitEntry;
