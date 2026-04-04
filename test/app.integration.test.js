import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";

process.env.APP_ENV = "test";
process.env.TEST_DB_NAME = process.env.TEST_DB_NAME || "url-shortner-integration";

const [{ createApp }, { default: connectDB }, { default: UrlModel }, { default: User }, { default: RateLimitEntry }] = await Promise.all([
    import("../app.js"),
    import("../dbConnection.js"),
    import("../model/url.models.js"),
    import("../model/user.models.js"),
    import("../model/rateLimitEntry.models.js")
]);

const SAMPLE_URL = "https://example.com/docs";
const CUSTOM_SHORT_ID = `alias${Date.now().toString().slice(-6)}`;
const UPDATED_CUSTOM_SHORT_ID = `${CUSTOM_SHORT_ID}_v2`;
const TEST_USERNAME = `tester_${Date.now()}`;
const TEST_DB_NAME = process.env.TEST_DB_NAME;

function toDateTimeLocalValue(date) {
    const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60 * 1000));
    return localDate.toISOString().slice(0, 16);
}

const EXPIRE_SOON = toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
const [EXPIRE_SOON_DATE, EXPIRE_SOON_TIME] = EXPIRE_SOON.split("T");

function buildDatabaseUrl(baseUrl, dbName) {
    const trimmedBaseUrl = String(baseUrl || "").trim();
    if (!trimmedBaseUrl) {
        throw new Error("TEST_DB_URL is required for integration tests.");
    }

    const parsedUrl = new globalThis.URL(trimmedBaseUrl);
    parsedUrl.pathname = `/${dbName}`;
    return parsedUrl.toString();
}

async function resetDatabase() {
    await Promise.all([
        UrlModel.deleteMany({}),
        User.deleteMany({}),
        RateLimitEntry.deleteMany({})
    ]);
}

async function run() {
    const dbUrl = buildDatabaseUrl(process.env.TEST_DB_URL, TEST_DB_NAME);
    await connectDB(dbUrl, TEST_DB_NAME, "integration-test");
    await resetDatabase();

    const app = createApp();

    try {
        await request(app)
            .get("/")
            .expect(200)
            .expect((response) => {
                assert.match(response.text, /Guest URL Shortener/);
            });

        await request(app)
            .post("/api")
            .type("form")
            .send({
                url: SAMPLE_URL
            })
            .expect(200);

        const guestUrl = await UrlModel.findOne({ redirectUrl: SAMPLE_URL, createdBy: null });
        assert.ok(guestUrl);

        await request(app)
            .post("/user")
            .type("form")
            .send({
                name: "Test User",
                username: TEST_USERNAME,
                password: "StrongPass1"
            })
            .expect(302)
            .expect("Location", "/");

        const createdUser = await User.findOne({ username: TEST_USERNAME });
        assert.ok(createdUser);
        assert.match(createdUser.password, /^\$2[aby]\$\d{2}\$/);
        createdUser.isAdmin = true;
        await createdUser.save();

        const loginResponse = await request(app)
            .post("/user/login")
            .type("form")
            .send({
                username: TEST_USERNAME,
                password: "StrongPass1"
            })
            .expect(302)
            .expect("Location", "/");

        const authCookie = loginResponse.headers["set-cookie"][0].split(";")[0];

        await request(app)
            .post("/api")
            .set("Cookie", authCookie)
            .type("form")
            .send({
                url: SAMPLE_URL
            })
            .expect(200);

        const userUrl = await UrlModel.findOne({ redirectUrl: SAMPLE_URL, createdBy: createdUser._id });
        assert.ok(userUrl);
        assert.notEqual(String(userUrl._id), String(guestUrl._id));

        const shortId = userUrl.shortId;

        await request(app)
            .post("/api")
            .set("Cookie", authCookie)
            .type("form")
            .send({
                url: "https://example.com/custom",
                customShortId: CUSTOM_SHORT_ID,
                expiresOn: EXPIRE_SOON_DATE,
                expiresAtTime: EXPIRE_SOON_TIME
            })
            .expect(200)
            .expect((response) => {
                assert.match(response.text, new RegExp(CUSTOM_SHORT_ID));
            });

        const customUrl = await UrlModel.findOne({ shortId: CUSTOM_SHORT_ID, createdBy: createdUser._id });
        assert.ok(customUrl);
        assert.equal(customUrl.redirectUrl, "https://example.com/custom");
        assert.ok(customUrl.expiresAt);

        await request(app)
            .post(`/api/manage/${CUSTOM_SHORT_ID}`)
            .set("Cookie", authCookie)
            .type("form")
            .send({
                customShortId: UPDATED_CUSTOM_SHORT_ID,
                url: "https://example.com/custom-updated",
                expiresOn: EXPIRE_SOON_DATE,
                expiresAtTime: EXPIRE_SOON_TIME
            })
            .expect(200);

        const updatedCustomUrl = await UrlModel.findOne({ shortId: UPDATED_CUSTOM_SHORT_ID, createdBy: createdUser._id });
        assert.ok(updatedCustomUrl);
        assert.equal(updatedCustomUrl.redirectUrl, "https://example.com/custom-updated");

        await request(app)
            .get(`/${shortId}`)
            .set("user-agent", "Googlebot/2.1")
            .set("cf-ipcountry", "IN")
            .expect(302)
            .expect("Location", SAMPLE_URL);

        await request(app)
            .get(`/${shortId}`)
            .set("cf-ipcountry", "IN")
            .expect(302)
            .expect("Location", SAMPLE_URL);

        const updatedUrl = await UrlModel.findOne({ _id: userUrl._id });
        assert.equal(updatedUrl.visitHistory.length, 2);
        assert.equal(updatedUrl.visitHistory[0].isBot, true);
        assert.equal(updatedUrl.visitHistory[1].country, "IN");
        assert.equal(updatedUrl.visitHistory[1].isBot, false);

        await request(app)
            .get(`/api/analytics/${shortId}`)
            .set("Cookie", authCookie)
            .set("Host", "sho.rt")
            .expect(200)
            .expect((response) => {
                assert.equal(response.body.shortId, shortId);
                assert.equal(response.body.redirectUrl, SAMPLE_URL);
                assert.equal(response.body.shortUrl, `http://sho.rt/${shortId}`);
                assert.equal(response.body.count, 1);
                assert.equal(response.body.botVisits, 1);
            });

        await request(app)
            .get("/profile")
            .set("Cookie", authCookie)
            .expect(200)
            .expect((response) => {
                assert.match(response.text, /Profile & URL Stats/);
                assert.match(response.text, /Bot Visits Filtered/);
                assert.match(response.text, /Admin Moderation/);
            });

        await request(app)
            .post(`/api/admin/moderate/${shortId}`)
            .set("Cookie", authCookie)
            .type("form")
            .send({
                action: "disable",
                disabledReason: "Abuse review"
            })
            .expect(302)
            .expect("Location", "/profile");

        await request(app)
            .get(`/${shortId}`)
            .expect(403);

        await request(app)
            .post(`/api/delete/${UPDATED_CUSTOM_SHORT_ID}`)
            .set("Cookie", authCookie)
            .expect(200);

        const deletedCustomUrl = await UrlModel.findOne({ shortId: UPDATED_CUSTOM_SHORT_ID });
        assert.equal(deletedCustomUrl, null);

        await request(app)
            .post("/user/logout")
            .set("Cookie", authCookie)
            .expect(302)
            .expect("Location", "/login");

        await request(app)
            .get("/profile")
            .set("Cookie", authCookie)
            .expect(302)
            .expect("Location", "/login");

        console.log("Integration test passed: validated Mongo-backed URL flow end to end.");
    } finally {
        await resetDatabase();
        await mongoose.disconnect();
    }
}

run().catch(async (error) => {
    console.error(error);

    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }

    process.exit(1);
});
