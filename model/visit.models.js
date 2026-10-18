import mongoose from "mongoose";

const visitSchema = new mongoose.Schema(
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

const Visit = mongoose.model("visit", visitSchema);

export default Visit;
