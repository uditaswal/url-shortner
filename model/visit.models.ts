import mongoose from "mongoose";

export interface VisitFields {
    urlId: mongoose.Types.ObjectId;
    timestamp: Date;
    country: string;
    isBot: boolean;
    userAgent?: string | null;
    createdAt: Date;
    updatedAt: Date;
}

const visitSchema = new mongoose.Schema<VisitFields>(
    {
        urlId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "url",
            required: true,
            index: true
        },
        timestamp: {
            type: Date,
            required: true,
            default: Date.now
        },
        country: {
            type: String,
            default: "Unknown"
        },
        isBot: {
            type: Boolean,
            default: false
        },
        userAgent: {
            type: String,
            default: null
        }
    },
    { timestamps: true }
);

visitSchema.index({ urlId: 1, timestamp: -1 }, { name: "url_visit_time_idx" });
visitSchema.index({ urlId: 1, isBot: 1 }, { name: "url_visit_bot_idx" });
visitSchema.index(
    { timestamp: 1 },
    { expireAfterSeconds: 90 * 24 * 60 * 60, name: "visit_retention_ttl_idx" }
);

const Visit = mongoose.model<VisitFields>("visit", visitSchema);

export default Visit;
