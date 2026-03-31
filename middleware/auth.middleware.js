import { getUser } from "../util/auth.util.js";

export async function restrictToLogginUserOnly(req, res, next) {
    const userUid = req.cookies?.uid;
    if (!userUid) return res.redirect('/login');

    const user = getUser(userUid);

    if (!user) return res.redirect("/login");
    req.user = user;
    next();
}

export async function checkAuth(req, res, next) {
    const userUid = req.cookies?.uid;

    const user = getUser(userUid);

    req.user = user;
    next();
}