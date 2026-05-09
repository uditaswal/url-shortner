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

function isJsonRequest(req) {
    return req.responseMode === "json";
}

function authSuccessPayload(user) {
    return {
        user: {
            id: user._id,
            name: user.name,
            username: user.username,
            isAdmin: user.isAdmin ?? false
        }
    };
}

function renderSignup(res, values = {}, error = null, statusCode = 400) {
    return res.status(statusCode).render("signup", {
        error,
        values
    });
}

function renderLogin(res, values = {}, error = null, statusCode = 400) {
    return res.status(statusCode).render("login", {
        error,
        values
    });
}

export async function handleUserSignup(req, res) {
    if (!isSafePlainInput(req.body.name) || !isSafePlainInput(req.body.username) || !isSafePlainInput(req.body.password)) {
        if (isJsonRequest(req)) {
            return res.status(400).json({ error: "Invalid input format." });
        }

        return renderSignup(res, {}, "Invalid input format.");
    }

    const name = sanitizeTextInput(req.body.name);
    const username = normalizeUsername(req.body.username);
    const password = sanitizeTextInput(req.body.password);

    if (!name) {
        if (isJsonRequest(req)) {
            return res.status(400).json({ error: "Name is required." });
        }

        return renderSignup(res, { name, username }, "Name is required.");
    }

    if (!isValidUsername(username || "")) {
        if (isJsonRequest(req)) {
            return res.status(400).json({
                error: "Username must be 3 to 20 characters and can contain lowercase letters, numbers, and underscores."
            });
        }

        return renderSignup(
            res,
            { name, username },
            "Username must be 3 to 20 characters and can contain lowercase letters, numbers, and underscores."
        );
    }

    if (!isStrongPassword(password || "")) {
        if (isJsonRequest(req)) {
            return res.status(400).json({
                error: "Password must be at least 8 characters and include uppercase, lowercase, and a number."
            });
        }

        return renderSignup(
            res,
            { name, username },
            "Password must be at least 8 characters and include uppercase, lowercase, and a number."
        );
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
        if (isJsonRequest(req)) {
            return res.status(409).json({ error: "This username is already taken." });
        }

        return renderSignup(res, { name, username }, "This username is already taken.", 409);
    }

    const user = await User.create({
        name,
        username,
        password
    });

    const token = setUser(user);
    res.cookie("uid", token, authCookieOptions);

    if (isJsonRequest(req)) {
        return res.status(201).json({
            message: "User created successfully.",
            ...authSuccessPayload(user)
        });
    }

    return res.redirect("/");
}

export async function handleUserLogin(req, res) {
    if (!isSafePlainInput(req.body.username) || !isSafePlainInput(req.body.password)) {
        if (isJsonRequest(req)) {
            return res.status(400).json({ error: "Invalid input format." });
        }

        return renderLogin(res, {}, "Invalid input format.");
    }

    const username = normalizeUsername(req.body.username);
    const password = sanitizeTextInput(req.body.password);

    if (!isValidUsername(username || "")) {
        if (isJsonRequest(req)) {
            return res.status(400).json({
                error: "Enter a valid username using lowercase letters, numbers, or underscores."
            });
        }

        return renderLogin(
            res,
            { username },
            "Enter a valid username using lowercase letters, numbers, or underscores."
        );
    }

    if (!password) {
        if (isJsonRequest(req)) {
            return res.status(400).json({ error: "Password is required." });
        }

        return renderLogin(res, { username }, "Password is required.");
    }

    const user = await User.findOne({ username });
    if (!user) {
        if (isJsonRequest(req)) {
            return res.status(401).json({ error: "Invalid username or password." });
        }

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
        if (isJsonRequest(req)) {
            return res.status(401).json({ error: "Invalid username or password." });
        }

        return renderLogin(res, { username }, "Invalid username or password.");
    }

    const token = setUser(user);
    res.cookie("uid", token, authCookieOptions);

    if (isJsonRequest(req)) {
        return res.status(200).json({
            message: "Login successful.",
            ...authSuccessPayload(user)
        });
    }

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

    if (isJsonRequest(req)) {
        return res.status(200).json({
            message: "Logout successful."
        });
    }

    return res.redirect("/login");
}
