import assert from "node:assert/strict";
import mongoose from "mongoose";
import request from "supertest";
import type { Express } from "express";
import type { HydratedDocument } from "mongoose";
import type { UserFields } from "../model/user.models.js";

process.env.APP_ENV = "test";
process.env.TEST_DB_NAME = process.env.TEST_DB_NAME || "url-shortner-integration";

const [
    { createApp },
    { default: connectDB },
    { default: UrlModel },
    { default: User },
    { default: RateLimitEntry },
    { default: Visit },
    { default: MongoRateLimitStore }
] = await Promise.all([
    import("../app.js"),
    import("../dbConnection.js"),
    import("../model/url.models.js"),
    import("../model/user.models.js"),
    import("../model/rateLimitEntry.models.js"),
    import("../model/visit.models.js"),
    import("../util/rateLimitStore.util.js")
]);

const SAMPLE_URL = "https://example.com/docs";
const CUSTOM_SHORT_ID = `alias${Date.now().toString().slice(-6)}`;
const UPDATED_CUSTOM_SHORT_ID = `${CUSTOM_SHORT_ID}_v2`;
const TEST_USERNAME = `tester_${Date.now()}`;
const FIRST_USER_USERNAME = `owner_a_${Date.now().toString().slice(-10)}`;
const SECOND_USER_USERNAME = `owner_b_${Date.now().toString().slice(-10)}`;
const TEST_DB_NAME = process.env.TEST_DB_NAME || "url-shortner-integration";

function toDateTimeLocalValue(date: Date): string {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
    return localDate.toISOString().slice(0, 16);
}

const EXPIRE_SOON_DATE_OBJECT = new Date(Date.now() + 60 * 60 * 1000);
const EXPIRE_SOON = toDateTimeLocalValue(EXPIRE_SOON_DATE_OBJECT);
const EXPIRE_SOON_INSTANT = EXPIRE_SOON_DATE_OBJECT.toISOString();
const [EXPIRE_SOON_DATE, EXPIRE_SOON_TIME] = EXPIRE_SOON.split("T");

function buildDatabaseUrl(baseUrl: string | undefined, dbName: string): string {
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
        RateLimitEntry.deleteMany({}),
        Visit.deleteMany({})
    ]);
}

async function waitFor(check: () => boolean | Promise<boolean>, message: string, timeoutMs = 2000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await check()) return;
        await new Promise((resolve) => setTimeout(resolve, 25));
    }

    throw new Error(message);
}

async function createOrdinaryUser(
    app: Express,
    username: string,
    name: string
): Promise<{
    user: HydratedDocument<UserFields>;
    cookie: string;
}> {
    const response = await request(app)
        .post("/api/auth/signup")
        .send({ name, username, password: "StrongPass1" })
        .expect(201);

    const user = await User.findOne({ username });
    assert.ok(user);

    return {
        user,
        cookie: response.headers["set-cookie"][0].split(";")[0]
    };
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
                assert.match(response.text, /URL Shortener/);
            });

        await request(app)
            .get("/ui")
            .expect(200)
            .expect((response) => {
                assert.match(response.text, /URL Shortener/);
            });

        await request(app)
            .get("/ui/login")
            .expect(200)
            .expect((response) => {
                assert.match(response.text, /Sign in/);
            });

        await request(app)
            .get("/ui/signup")
            .expect(200)
            .expect((response) => {
                assert.match(response.text, /Create an account/);
            });

        await request(app)
            .post("/api/urls")
            .send({
                url: "https://example.com/time-only",
                expiresAtTime: EXPIRE_SOON_TIME
            })
            .expect(400)
            .expect((response) => {
                assert.equal(response.body.error, "Choose both an expiration date and time.");
            });

        await request(app)
            .post("/api/urls")
            .send({ url: "https://example.com/reserved", customShortId: "profile" })
            .expect(400)
            .expect((response) => {
                assert.match(response.body.error, /reserved/);
            });

        await request(app)
            .post("/api/auth/login")
            .set("Origin", "https://untrusted.example")
            .set("Sec-Fetch-Site", "cross-site")
            .send({ username: "nobody", password: "StrongPass1" })
            .expect(403)
            .expect((response) => {
                assert.equal(response.body.error, "Cross-site requests are not allowed.");
                assert.equal(response.headers["set-cookie"], undefined);
            });

        await request(app)
            .post("/api/urls")
            .send({
                url: "https://example.com/date-only",
                expiresOn: EXPIRE_SOON_DATE
            })
            .expect(400)
            .expect((response) => {
                assert.equal(response.body.error, "Choose both an expiration date and time.");
            });

        await request(app)
            .post("/api/urls")
            .send({
                url: SAMPLE_URL
            })
            .expect(201)
            .expect((response) => {
                assert.equal(response.body.url.redirectUrl, SAMPLE_URL);
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

        const anotherGuestLink = await request(app)
            .post("/api/urls")
            .send({ url: SAMPLE_URL })
            .expect(201);
        assert.notEqual(anotherGuestLink.body.url.shortId, guestUrl.shortId);

        const guestAlias = "guest-custom";
        const customGuestLink = await request(app)
            .post("/api/urls")
            .send({ url: SAMPLE_URL, customShortId: guestAlias, expiresAt: EXPIRE_SOON_INSTANT })
            .expect(201);
        assert.equal(customGuestLink.body.url.shortId, guestAlias);
        assert.ok(customGuestLink.body.url.expiresAt);
        const guestUrlAfter = await UrlModel.findById(guestUrl._id);
        assert.ok(guestUrlAfter);
        assert.equal(guestUrlAfter.expiresAt, null);

        await request(app)
            .post("/ui/urls")
            .type("form")
            .send({ url: SAMPLE_URL, customShortId: "guest-other" })
            .expect(200)
            .expect((response) => {
                assert.doesNotMatch(response.text, /This URL already exists/);
                assert.match(response.text, /id="shortUrl"[^>]*\/guest-other/);
            });

        await request(app)
            .post("/api/urls")
            .send({ url: SAMPLE_URL, customShortId: guestAlias })
            .expect(409)
            .expect((response) => {
                assert.match(response.body.error, /alias is already taken/);
                assert.ok(response.body.suggestedAlias);
                assert.equal(response.body.url, undefined);
            });

        await request(app)
            .post("/api/auth/signup")
            .send({
                name: "Test User",
                username: TEST_USERNAME,
                password: "StrongPass1"
            })
            .expect(201)
            .expect((response) => {
                assert.equal(response.body.user.username, TEST_USERNAME);
            });

        const legacyUsername = `legacy_${Date.now().toString().slice(-10)}`;
        await User.collection.insertOne({
            name: "Legacy User",
            username: legacyUsername,
            password: "StrongPass1",
            isAdmin: false,
            tokenVersion: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        await request(app)
            .post("/api/auth/login")
            .send({ username: legacyUsername, password: "StrongPass1" })
            .expect(200);
        const migratedLegacyUser = await User.findOne({ username: legacyUsername });
        assert.ok(migratedLegacyUser);
        assert.match(migratedLegacyUser.password, /^\$2[aby]\$\d{2}\$/);

        await request(app)
            .post("/user")
            .type("form")
            .send({
                name: "Test User",
                username: TEST_USERNAME,
                password: "StrongPass1"
            })
            .expect(409);

        const createdUser = await User.findOne({ username: TEST_USERNAME });
        assert.ok(createdUser);
        assert.match(createdUser.password, /^\$2[aby]\$\d{2}\$/);
        createdUser.isAdmin = true;
        await createdUser.save();

        const loginResponse = await request(app)
            .post("/api/auth/login")
            .send({
                username: TEST_USERNAME,
                password: "StrongPass1"
            })
            .expect(200)
            .expect((response) => {
                assert.equal(response.body.user.username, TEST_USERNAME);
            });

        await request(app)
            .post("/user/login")
            .type("form")
            .send({
                username: TEST_USERNAME,
                password: "StrongPass1"
            })
            .expect(302)
            .expect("Location", "/");

        await request(app)
            .post("/ui/auth/login")
            .type("form")
            .send({
                username: TEST_USERNAME,
                password: "StrongPass1"
            })
            .expect(302)
            .expect("Location", "/");

        const authCookie = loginResponse.headers["set-cookie"][0].split(";")[0];

        const firstOwner = await createOrdinaryUser(app, FIRST_USER_USERNAME, "First Owner");
        const secondOwner = await createOrdinaryUser(app, SECOND_USER_USERNAME, "Second Owner");
        assert.equal(firstOwner.user.isAdmin, false);
        assert.equal(secondOwner.user.isAdmin, false);

        const firstOwnerAlias = `owner-a-${Date.now().toString().slice(-6)}`;
        const secondOwnerAlias = `owner-b-${Date.now().toString().slice(-6)}`;

        await request(app)
            .post("/api/urls")
            .set("Cookie", firstOwner.cookie)
            .send({
                url: "https://example.com/owner-a",
                customShortId: firstOwnerAlias
            })
            .expect(201);

        await request(app)
            .post("/api/urls")
            .set("Cookie", secondOwner.cookie)
            .send({
                url: "https://example.com/owner-b",
                customShortId: secondOwnerAlias
            })
            .expect(201);

        await request(app)
            .post("/api/urls")
            .set("Cookie", secondOwner.cookie)
            .set("Host", "sho.rt")
            .send({
                url: "https://example.com/alias-conflict",
                customShortId: firstOwnerAlias
            })
            .expect(409)
            .expect((response) => {
                assert.match(response.body.error, /already taken/);
                assert.match(response.body.suggestedAlias, /^owner-a-\d{6}-[a-z2-9]{4}$/);
                assert.equal(
                    response.body.suggestedShortUrl,
                    `http://sho.rt/${response.body.suggestedAlias}`
                );
            });

        await request(app)
            .get(`/api/urls/${firstOwnerAlias}/analytics`)
            .set("Cookie", secondOwner.cookie)
            .expect(404);

        await request(app)
            .put(`/api/urls/${firstOwnerAlias}`)
            .set("Cookie", secondOwner.cookie)
            .send({
                url: "https://example.com/unauthorized-edit",
                customShortId: firstOwnerAlias
            })
            .expect(404);

        await request(app)
            .delete(`/api/urls/${firstOwnerAlias}`)
            .set("Cookie", secondOwner.cookie)
            .expect(404);

        await request(app)
            .patch(`/api/admin/urls/${firstOwnerAlias}/moderation`)
            .set("Cookie", secondOwner.cookie)
            .send({ action: "disable" })
            .expect(403);

        await request(app)
            .get("/api/dashboard")
            .set("Cookie", firstOwner.cookie)
            .expect(200)
            .expect((response) => {
                assert.deepEqual(
                    response.body.urls.map((url: { shortId: string }) => url.shortId),
                    [firstOwnerAlias]
                );
            });

        await request(app)
            .get("/api/dashboard")
            .set("Cookie", secondOwner.cookie)
            .expect(200)
            .expect((response) => {
                assert.deepEqual(
                    response.body.urls.map((url: { shortId: string }) => url.shortId),
                    [secondOwnerAlias]
                );
            });

        assert.ok(
            await UrlModel.exists({ shortId: firstOwnerAlias, createdBy: firstOwner.user._id })
        );

        await request(app)
            .post("/api/urls")
            .set("Cookie", authCookie)
            .send({
                url: SAMPLE_URL
            })
            .expect(201);

        const userUrl = await UrlModel.findOne({
            redirectUrl: SAMPLE_URL,
            createdBy: createdUser._id
        });
        assert.ok(userUrl);
        assert.notEqual(String(userUrl._id), String(guestUrl._id));

        const shortId = userUrl.shortId;

        const originalVisitCreate = Visit.create;
        (Visit as unknown as { create: (...args: unknown[]) => unknown }).create = () =>
            Promise.reject(new Error("Simulated analytics write failure"));
        try {
            await request(app).get(`/${shortId}`).expect(302).expect("Location", SAMPLE_URL);
            await new Promise((resolve) => setImmediate(resolve));
        } finally {
            (Visit as unknown as { create: (...args: unknown[]) => unknown }).create =
                originalVisitCreate;
        }
        assert.equal(await Visit.countDocuments({ urlId: userUrl._id }), 0);

        await request(app)
            .post("/api/urls")
            .set("Cookie", authCookie)
            .send({
                url: "https://example.com/custom",
                customShortId: CUSTOM_SHORT_ID,
                expiresOn: EXPIRE_SOON_DATE,
                expiresAtTime: EXPIRE_SOON_TIME,
                expiresAt: EXPIRE_SOON_INSTANT
            })
            .expect(201)
            .expect((response) => {
                assert.equal(response.body.url.shortId, CUSTOM_SHORT_ID);
            });

        const customUrl = await UrlModel.findOne({
            shortId: CUSTOM_SHORT_ID,
            createdBy: createdUser._id
        });
        assert.ok(customUrl);
        assert.equal(customUrl.redirectUrl, "https://example.com/custom");
        assert.ok(customUrl.expiresAt);

        await request(app)
            .put(`/api/urls/${CUSTOM_SHORT_ID}`)
            .set("Cookie", authCookie)
            .send({
                customShortId: UPDATED_CUSTOM_SHORT_ID,
                url: "https://example.com/custom-updated",
                expiresOn: EXPIRE_SOON_DATE,
                expiresAtTime: EXPIRE_SOON_TIME,
                expiresAt: EXPIRE_SOON_INSTANT
            })
            .expect(200)
            .expect((response) => {
                assert.equal(response.body.url.shortId, UPDATED_CUSTOM_SHORT_ID);
            });

        const updatedCustomUrl = await UrlModel.findOne({
            shortId: UPDATED_CUSTOM_SHORT_ID,
            createdBy: createdUser._id
        });
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

        await waitFor(
            async () => (await Visit.countDocuments({ urlId: userUrl._id })) === 2,
            "Redirect analytics were not persisted asynchronously."
        );
        const recordedVisits = await Visit.find({ urlId: userUrl._id }).sort({ timestamp: 1 });
        assert.equal(recordedVisits.length, 2);
        assert.equal(recordedVisits[0].isBot, true);
        assert.equal(recordedVisits[1].country, "IN");
        assert.equal(recordedVisits[1].isBot, false);

        const updatedUrl = await UrlModel.findOne({ _id: userUrl._id });
        assert.ok(updatedUrl);
        assert.equal(updatedUrl.visitHistory.length, 0);

        await request(app)
            .get(`/api/urls/${shortId}/analytics`)
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
            .get("/api/dashboard")
            .set("Cookie", authCookie)
            .expect(200)
            .expect((response) => {
                assert.ok(Array.isArray(response.body.urls));
                assert.equal(response.body.isGuestMode, false);
            });

        await request(app)
            .get("/profile")
            .set("Cookie", authCookie)
            .expect(200)
            .expect((response) => {
                assert.match(response.text, /Analytics/);
                assert.match(response.text, /Bots excluded/);
                assert.match(response.text, /Admin moderation/);
            });

        await request(app)
            .get("/ui/profile")
            .set("Cookie", authCookie)
            .expect(200)
            .expect((response) => {
                assert.match(response.text, /Analytics/);
            });

        await request(app)
            .patch(`/api/admin/urls/${shortId}/moderation`)
            .set("Cookie", authCookie)
            .send({
                action: "disable",
                disabledReason: "Abuse review"
            })
            .expect(200)
            .expect((response) => {
                assert.equal(response.body.url.isDisabled, true);
            });

        await request(app).get(`/${shortId}`).expect(403);

        await request(app)
            .delete(`/api/urls/${UPDATED_CUSTOM_SHORT_ID}`)
            .set("Cookie", authCookie)
            .expect(200);

        const deletedCustomUrl = await UrlModel.findOne({ shortId: UPDATED_CUSTOM_SHORT_ID });
        assert.equal(deletedCustomUrl, null);

        const simulatedNow = new Date(Date.now() + 2 * 60_000);
        const concurrentStore = new MongoRateLimitStore("concurrency-test", () => simulatedNow);
        concurrentStore.init({ windowMs: 60_000 });
        await RateLimitEntry.create({
            key: "concurrency-test:shared-client",
            totalHits: 99,
            resetTime: new Date(Date.now() + 60_000)
        });

        const concurrentResults = await Promise.all(
            Array.from({ length: 25 }, () => concurrentStore.increment("shared-client"))
        );
        const finalRateLimitEntry = await RateLimitEntry.findOne({
            key: "concurrency-test:shared-client"
        });
        assert.ok(finalRateLimitEntry);
        assert.equal(finalRateLimitEntry.totalHits, 25);
        assert.deepEqual(
            concurrentResults.map((result) => result.totalHits).sort((a, b) => a - b),
            Array.from({ length: 25 }, (_value, index) => index + 1)
        );
        assert.equal(
            new Set(concurrentResults.map((result) => result.resetTime.getTime())).size,
            1
        );

        const logoutResponse = await request(app)
            .post("/ui/auth/logout")
            .set("Cookie", authCookie)
            .set("Origin", "https://untrusted.example")
            .set("Sec-Fetch-Site", "cross-site")
            .expect(302)
            .expect("Location", "/login");
        assert.match(logoutResponse.headers["set-cookie"]?.[0] || "", /^uid=;/);

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
