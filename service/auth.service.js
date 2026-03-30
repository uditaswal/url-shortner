import jwt from "jsonwebtoken"
import dotenv from "dotenv";

dotenv.config({ path: '.env' });
const JWTsecretKey = process.env.JWTsecretKey;

export function setUser(user) {
    const payload = {
        _id: user._id,
        name: user.name,
        email: user.email,
    };
    return jwt.sign(payload, JWTsecretKey, { expiresIn: "1d" });
}

export function getUser(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, JWTsecretKey);
    } catch (err) {
        return null;
    }
}

export function removeUser(token) {
    if (!token) return null;
    try {
        return jwt.verify(token, JWTsecretKey);
    } catch (err) {
        return null;
    }
}

