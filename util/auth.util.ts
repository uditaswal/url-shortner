import jwt from "jsonwebtoken";
import config from "./config.util.js";
import { logError } from "./logger.util.js";
import type { HydratedDocument } from "mongoose";
import type { UserFields } from "../model/user.models.js";
import type { CookieOptions } from "express";

const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface AuthTokenPayload extends jwt.JwtPayload {
    _id: string;
    name: string;
    username: string;
    isAdmin: boolean;
    tokenVersion: number;
}

export function setUser(user: HydratedDocument<UserFields>) {
    const payload = {
        _id: user._id,
        name: user.name,
        username: user.username,
        isAdmin: user.isAdmin ?? false,
        tokenVersion: user.tokenVersion ?? 0
    };
    return jwt.sign(payload, config.jwtSecretKey, { expiresIn: "1d" });
}

export function getUser(token: string | undefined): AuthTokenPayload | null {
    if (!token) return null;
    try {
        const payload = jwt.verify(token, config.jwtSecretKey);
        if (typeof payload === "string" || typeof payload._id !== "string") {
            return null;
        }
        return payload as AuthTokenPayload;
    } catch (err) {
        logError(err, { source: "auth-token" });
        return null;
    }
}

export function getAuthCookieOptions(): CookieOptions {
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: config.isProduction,
        maxAge: AUTH_COOKIE_MAX_AGE_MS
    };
}

export function removeUser(token: string | undefined): AuthTokenPayload | null {
    if (!token) return null;
    try {
        const payload = jwt.verify(token, config.jwtSecretKey);
        if (typeof payload === "string" || typeof payload._id !== "string") {
            return null;
        }
        return payload as AuthTokenPayload;
    } catch (err) {
        logError(err, { source: "auth-token" });
        return null;
    }
}
