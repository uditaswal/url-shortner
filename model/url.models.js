import mongoose from "mongoose";

const urlSchema = new mongoose.Schema({
    shortId: {
        type: String,
        required: true,
        unique: true,
    }, redirectUrl: {
        type: String,
        required: true,
    }, expiresAt: {
        type: Date,
        default: null
    }, isDisabled: {
        type: Boolean,
        default: false
    }, disabledReason: {
        type: String,
        default: null
    }, lastEditedAt: {
        type: Date,
        default: null
    }, visitHistory: [{
        timestamp: { type: Number },
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
    }], createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
    },
}, { timestamps: true });

urlSchema.index({ shortId: 1 }, { unique: true, name: "shortId_unique_idx" });
urlSchema.index({ redirectUrl: 1, createdBy: 1 }, { unique: true, name: "redirectUrl_owner_unique_idx" });

const URL = mongoose.model('url', urlSchema);

export default URL;
