import express from 'express';
import URL from "../model/url.models.js";

const staticRouter = express.Router();

staticRouter.route("/").get(async (req, res) => {
    const allUsers = await URL.find({});
    return res.render('home', {
        urls: allUsers,
    });

})

staticRouter.route("/login").get((req, res) => {
    return res.render('login')
})


export default staticRouter;