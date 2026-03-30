import express from 'express';
import URL from "../model/url.models.js";

const staticRouter = express.Router();

staticRouter.route("/").get(async (req, res) => {

    if (!req.user) return res.redirect("/login")

    const allUsers = await URL.find({ createdBy: req.user._id });
    return res.render('home', {
        urls: allUsers,
    });

})

staticRouter.route("/profile").get(async (req, res) => {
    if (!req.user) return res.redirect("/login");

    const userUrls = await URL.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    const totalUrls = userUrls.length;
    const totalClicks = userUrls.reduce((sum, item) => sum + (item.visitHistory?.length || 0), 0);
    const activeUrls = userUrls.filter((item) => (item.visitHistory?.length || 0) > 0).length;

    return res.render("profile", {
        stats: {
            totalUrls,
            totalClicks,
            activeUrls,
        },
        urls: userUrls,
    });
});

staticRouter.route("/login").get((req, res) => {
    return res.render('login')
})


export default staticRouter;
