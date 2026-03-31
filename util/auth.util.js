import jwt from "jsonwebtoken"
import config from "./config.util.js";

export function setUser(user) {
    const payload = {
        _id: user._id,
        name: user.name,
        username: user.username,
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

export function removeUser(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, config.jwtSecretKey);
    } catch (err) {
        return null;
    }
}

