import User from "../model/user.models.js";
import { v4 as uuidv4 } from 'uuid';
import { setUser } from '../service/auth.service.js'
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

    const sessionId = uuidv4();
    setUser(sessionId, user);

    res.cookie("uid", sessionId)

    return res.redirect("/");
}

