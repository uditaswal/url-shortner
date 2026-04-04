import User from "../model/user.models.js";
import { getUser } from "../util/auth.util.js";

async function resolveAuthenticatedUser(token) {
    const payload = getUser(token);
    if (!payload?._id) {
        return null;
    }

    const user = await User.findById(payload._id).select("_id name username isAdmin tokenVersion");
    if (!user) {
        return null;
    }

    if ((payload.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
        return null;
    }

    return {
        _id: user._id,
        name: user.name,
        username: user.username,
        isAdmin: user.isAdmin,
        tokenVersion: user.tokenVersion
    };
}

export async function restrictToLogginUserOnly(req, res, next) {
    const userUid = req.cookies?.uid;
    if (!userUid) return res.redirect('/login');

    const user = await resolveAuthenticatedUser(userUid);

    if (!user) return res.redirect("/login");
    req.user = user;
    next();
}

export async function checkAuth(req, res, next) {
    const userUid = req.cookies?.uid;

    const user = await resolveAuthenticatedUser(userUid);

    req.user = user;
    next();
}

export async function restrictToAdminOnly(req, res, next) {
    const userUid = req.cookies?.uid;
    if (!userUid) return res.redirect("/login");

    const user = await resolveAuthenticatedUser(userUid);
    if (!user?.isAdmin) {
        return res.status(403).render("login", {
            error: "Admin access required."
        });
    }

    req.user = user;
    next();
}
