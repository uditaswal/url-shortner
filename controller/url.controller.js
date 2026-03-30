import URL from "../model/url.models.js";
import { nanoid } from 'nanoid';

export async function generateShortId(req, res) {
    try {
        const url = req.body.url;
        if (!url) return res.status(400).json({ error: "url is required" });
        const shortId = nanoid(8);
        const newUrl = await URL.create({
            shortId,
            redirectUrl: url,
            visitHistory: [],
            createdBy: req.user._id,
        });

        console.log("Short Id inserted in DB:", newUrl);
        return res.render("home", {
            url: `http://localhost:3000/api/${shortId}`
        })
        // return res.redirect("/");

        // return res.status(200).json({
        //     message: "Short URL Generated",
        //     shortId: shortId,
        //     url: `http://localhost:3000/api/${shortId}`
        // })
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            error: "Internal Server Error"

        })
    }
};

export async function redirectToShortURL(req, res) {
    try {
        const shortId = req.params.shortId;
        const entry = await URL.findOne({ shortId })

        if (!entry) {
            return res.status(404).json({
                error: "Short URL not found"
            });
        }

        await URL.findOneAndUpdate({ shortId, },
            {
                $push: {
                    visitHistory: {
                        timestamp: Date.now()
                    }
                },

            }
        )
        return res.redirect(entry.redirectUrl);

    } catch (err) {
        console.log(err);
        return res.status(500).json({
            error: "Internal Server Error"

        })
    }

}

export async function getShortURLAnalytics(req, res) {
    try {

        const shortId = req.params.shortId;
        const entry = await URL.findOne({ shortId })
        return res.json({
            shortId: shortId,
            redirectUrl: entry.redirectUrl,
            shortUrl: `http://localhost:3000/${shortId}`,
            count: entry.visitHistory.length,
            visitHistory: entry.visitHistory

        })
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({
            error: "Internal Server Error"

        })
    }



}