import jwt from "jsonwebtoken"
import config from "./config.util.js";

const AUTH_COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function setUser(user) {
    const payload = {
        _id: user._id,
        name: user.name,
        username: user.username,
        isAdmin: user.isAdmin ?? false,
        tokenVersion: user.tokenVersion ?? 0,
    };
    return jwt.sign(payload, config.jwtSecretKey, { expiresIn: "1d" });
}

export function getUser(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, config.jwtSecretKey);
    } catch (err) {
        return null;
    }
}

export function getAuthCookieOptions() {
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: config.isProduction,
        maxAge: AUTH_COOKIE_MAX_AGE_MS
    };
}

export function removeUser(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, config.jwtSecretKey);
    } catch (err) {
        return null;
    }
}

