import User from "../model/user.models.js";
import { setUser, removeUser } from '../service/auth.service.js'
export async function handleUserSignup(req, res) {
    const { name, email, password } = req.body;
    await User.create({
        name,
        email,
        password

    });

    return res.render("home");
}

export async function handleUserLogin(req, res) {
    const { name, email, password } = req.body;
    const user = await User.findOne({ email, password });
    if (!user)
        return res.render("login", {
            error: "Invalid username or password"
        })

    const token = setUser(user);
    res.cookie("uid", token, { httpOnly: true });

    return res.redirect("/");
}

export async function handleUserLogout(req, res) {
    const token = req.cookies?.uid;

    removeUser(token);

    res.clearCookie("uid");
    return res.redirect("/login");
}

