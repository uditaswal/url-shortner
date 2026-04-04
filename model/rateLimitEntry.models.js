import mongoose from "mongoose";

const rateLimitEntrySchema = new mongoose.Schema({
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
}, { timestamps: true });

rateLimitEntrySchema.index({ resetTime: 1 }, { expireAfterSeconds: 0, name: "rate_limit_reset_ttl_idx" });

const RateLimitEntry = mongoose.model("rate_limit_entry", rateLimitEntrySchema);

export default RateLimitEntry;
