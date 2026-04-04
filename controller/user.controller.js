import User from "../model/user.models.js";
import { getAuthCookieOptions, removeUser, setUser } from '../util/auth.util.js'
import {
    isSafePlainInput,
    isStrongPassword,
    isValidUsername,
    sanitizeTextInput,
    normalizeUsername
} from "../util/validation.util.js";

const bcryptHashRegex = /^\$2[aby]\$\d{2}\$/;
const authCookieOptions = getAuthCookieOptions();

function renderSignup(res, values = {}, error = null) {
    return res.status(400).render("signup", {
        error,
        values
    });
}

function renderLogin(res, values = {}, error = null) {
    return res.status(400).render("login", {
        error,
        values
    });
}

export async function handleUserSignup(req, res) {
    if (!isSafePlainInput(req.body.name) || !isSafePlainInput(req.body.username) || !isSafePlainInput(req.body.password)) {
        return renderSignup(res, {}, "Invalid input format.");
    }

    const name = sanitizeTextInput(req.body.name);
    const username = normalizeUsername(req.body.username);
    const password = sanitizeTextInput(req.body.password);

    if (!name) {
        return renderSignup(res, { name, username }, "Name is required.");
    }

    if (!isValidUsername(username || "")) {
        return renderSignup(
            res,
            { name, username },
            "Username must be 3 to 20 characters and can contain lowercase letters, numbers, and underscores."
        );
    }

    if (!isStrongPassword(password || "")) {
        return renderSignup(
            res,
            { name, username },
            "Password must be at least 8 characters and include uppercase, lowercase, and a number."
        );
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
        return renderSignup(res, { name, username }, "This username is already taken.");
    }

    const user = await User.create({
        name,
        username,
        password
    });

    const token = setUser(user);
    res.cookie("uid", token, authCookieOptions);

    return res.redirect("/");
}

export async function handleUserLogin(req, res) {
    if (!isSafePlainInput(req.body.username) || !isSafePlainInput(req.body.password)) {
        return renderLogin(res, {}, "Invalid input format.");
    }

    const username = normalizeUsername(req.body.username);
    const password = sanitizeTextInput(req.body.password);

    if (!isValidUsername(username || "")) {
        return renderLogin(
            res,
            { username },
            "Enter a valid username using lowercase letters, numbers, or underscores."
        );
    }

    if (!password) {
        return renderLogin(res, { username }, "Password is required.");
    }

    const user = await User.findOne({ username });
    if (!user) {
        return renderLogin(res, { username }, "Invalid username or password.");
    }

    let isPasswordValid = false;

    if (bcryptHashRegex.test(user.password)) {
        isPasswordValid = await user.comparePassword(password);
    } else if (user.password === password) {
        user.password = password;
        await user.save();
        isPasswordValid = true;
    }

    if (!isPasswordValid) {
        return renderLogin(res, { username }, "Invalid username or password.");
    }

    const token = setUser(user);
    res.cookie("uid", token, authCookieOptions);

    return res.redirect("/");
}

export async function handleUserLogout(req, res) {
    const token = req.cookies?.uid;
    const payload = removeUser(token);

    if (payload?._id) {
        await User.findByIdAndUpdate(payload._id, {
            $inc: {
                tokenVersion: 1
            }
        });
    }

    res.clearCookie("uid", authCookieOptions);
    return res.redirect("/login");
}
