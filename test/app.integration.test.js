import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import request from "supertest";

import { createApp } from "../app.js";
import URL from "../model/url.models.js";
import User from "../model/user.models.js";

const SAMPLE_URL = "https://example.com/docs";

function createUrlQueryResult(items) {
    return {
        sort: async () => items
    };
}

async function run() {
    const app = createApp();
    const users = [];
    const urls = [];

    const originalUserFindOne = User.findOne;
    const originalUserCreate = User.create;
    const originalUrlFind = URL.find;
    const originalUrlFindOne = URL.findOne;
    const originalUrlCreate = URL.create;
    const originalUrlFindOneAndUpdate = URL.findOneAndUpdate;

    try {
        User.findOne = async (query) => {
            if (query.username) {
                return users.find((user) => user.username === query.username) || null;
            }

            return null;
        };

        User.create = async ({ name, username, password }) => {
            const hashedPassword = await bcrypt.hash(password, 10);
            const user = {
                _id: `user-${users.length + 1}`,
                name,
                username,
                password: hashedPassword,
                comparePassword(candidatePassword) {
                    return bcrypt.compare(candidatePassword, this.password);
                }
            };

            users.push(user);
            return user;
        };

        URL.find = (query = {}) => {
            if (query.createdBy) {
                return createUrlQueryResult(urls.filter((item) => item.createdBy === query.createdBy));
            }

            return createUrlQueryResult(urls);
        };

        URL.findOne = async (query = {}) => {
            if (query.shortId && query.createdBy) {
                return urls.find((item) => item.shortId === query.shortId && item.createdBy === query.createdBy) || null;
            }

            if (query.shortId) {
                return urls.find((item) => item.shortId === query.shortId) || null;
            }

            if (query.redirectUrl && Object.prototype.hasOwnProperty.call(query, "createdBy")) {
                return urls.find((item) => item.redirectUrl === query.redirectUrl && item.createdBy === query.createdBy) || null;
            }

            if (query.redirectUrl) {
                return urls.find((item) => item.redirectUrl === query.redirectUrl) || null;
            }

            return null;
        };

        URL.create = async ({ shortId, redirectUrl, visitHistory, createdBy }) => {
            const entry = {
                _id: `url-${urls.length + 1}`,
                shortId,
                redirectUrl,
                visitHistory: visitHistory || [],
                createdBy,
                createdAt: new Date("2026-03-31T12:00:00.000Z")
            };

            urls.push(entry);
            return entry;
        };

        URL.findOneAndUpdate = async ({ shortId }, update) => {
            const entry = urls.find((item) => item.shortId === shortId);
            if (!entry) {
                return null;
            }

            const visit = update?.$push?.visitHistory;
            if (visit) {
                entry.visitHistory.push(visit);
            }

            return entry;
        };

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

        assert.equal(urls.length, 1);
        assert.equal(urls[0].createdBy, null);

        await request(app)
            .post("/user")
            .type("form")
            .send({
                name: "Test User",
                username: "tester_01",
                password: "StrongPass1"
            })
            .expect(302)
            .expect("Location", "/");

        const loginResponse = await request(app)
            .post("/user/login")
            .type("form")
            .send({
                username: "tester_01",
                password: "StrongPass1"
            })
            .expect(302)
            .expect("Location", "/");

        const authCookie = loginResponse.headers["set-cookie"][0].split(";")[0];

        const createResponse = await request(app)
            .post("/api")
            .set("Cookie", authCookie)
            .type("form")
            .send({
                url: SAMPLE_URL
            })
            .expect(200);

        assert.match(createResponse.text, /Your URL Dashboard/);
        assert.match(createResponse.text, /example\.com\/docs/);
        assert.equal(urls.length, 2);

        const userUrl = urls.find((entry) => entry.createdBy === "user-1");
        assert.ok(userUrl);

        const shortId = userUrl.shortId;

        await request(app)
            .get(`/${shortId}`)
            .set("cf-ipcountry", "IN")
            .expect(302)
            .expect("Location", SAMPLE_URL);

        assert.equal(userUrl.visitHistory.length, 1);
        assert.equal(userUrl.visitHistory[0].country, "IN");

        await request(app)
            .get(`/api/analytics/${shortId}`)
            .set("Cookie", authCookie)
            .expect(200)
            .expect((response) => {
                assert.equal(response.body.shortId, shortId);
                assert.equal(response.body.redirectUrl, SAMPLE_URL);
                assert.equal(response.body.count, 1);
            });

        await request(app)
            .get("/profile")
            .set("Cookie", authCookie)
            .expect(200)
            .expect((response) => {
                assert.match(response.text, /Profile & URL Stats/);
                assert.match(response.text, /Country Stats/);
                assert.match(response.text, /IN/);
            });

        await request(app)
            .post("/user/logout")
            .set("Cookie", authCookie)
            .expect(302)
            .expect("Location", "/login");

        console.log("Integration test passed: validated main endpoints with one URL flow.");
    } finally {
        User.findOne = originalUserFindOne;
        User.create = originalUserCreate;
        URL.find = originalUrlFind;
        URL.findOne = originalUrlFindOne;
        URL.create = originalUrlCreate;
        URL.findOneAndUpdate = originalUrlFindOneAndUpdate;
    }
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
