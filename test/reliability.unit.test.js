import assert from "node:assert/strict";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

process.env.APP_ENV = "test";
process.env.TEST_DB_URL = process.env.TEST_DB_URL || "mongodb://127.0.0.1:27017/";
process.env.TEST_DB_NAME = process.env.TEST_DB_NAME || "url-shortner-unit";
process.env.TEST_JWT_SECRET_KEY = process.env.TEST_JWT_SECRET_KEY || "unit-test-secret";

const { normalizeCreatePayload, redirectToShortURL, validateCreatePayload } = await import(
    "../controller/url.controller.js"
);
const { default: UrlModel } = await import("../model/url.models.js");
const { default: Visit } = await import("../model/visit.models.js");

const future = new Date(Date.now() + 60 * 60 * 1000);
const futureLocal = new Date(future.getTime() - future.getTimezoneOffset() * 60 * 1000)
    .toISOString()
    .slice(0, 16);
const [futureDate, futureTime] = futureLocal.split("T");

const timeOnly = normalizeCreatePayload({
    url: "https://example.com/time-only",
    expiresAtTime: futureTime
});
assert.equal(validateCreatePayload(timeOnly), "Choose both an expiration date and time.");

const dateOnly = normalizeCreatePayload({
    url: "https://example.com/date-only",
    expiresOn: futureDate
});
assert.equal(validateCreatePayload(dateOnly), "Choose both an expiration date and time.");

const completeExpiration = normalizeCreatePayload({
    url: "https://example.com/complete-expiration",
    expiresOn: futureDate,
    expiresAtTime: futureTime
});
assert.equal(validateCreatePayload(completeExpiration), null);
assert.ok(completeExpiration.expiresAt.getTime() > Date.now());

const originalUrlFindOne = UrlModel.findOne;
const originalVisitCreate = Visit.create;
let redirectLocation = null;
UrlModel.findOne = async () => ({
    _id: "507f1f77bcf86cd799439011",
    shortId: "sample1",
    redirectUrl: "https://example.com/destination",
    expiresAt: null,
    isDisabled: false
});
Visit.create = () => Promise.reject(new Error("Simulated analytics outage"));

try {
    await redirectToShortURL(
        {
            params: { shortId: "sample1" },
            headers: {},
            get: (header) => (header === "user-agent" ? "unit-test-agent" : null)
        },
        {
            status() {
                return this;
            },
            json(payload) {
                throw new Error(`Unexpected JSON response: ${JSON.stringify(payload)}`);
            },
            redirect(location) {
                redirectLocation = location;
                return this;
            }
        }
    );
    await new Promise((resolve) => setImmediate(resolve));
} finally {
    UrlModel.findOne = originalUrlFindOne;
    Visit.create = originalVisitCreate;
}

assert.equal(redirectLocation, "https://example.com/destination");

const probeDirectory = mkdtempSync(path.join(tmpdir(), "url-shortener-logger-"));
const loggerUrl = pathToFileURL(path.resolve("util/logger.util.js")).href;
const loggerProbe = spawnSync(
    process.execPath,
    [
        "--input-type=module",
        "--eval",
        `import logger from ${JSON.stringify(loggerUrl)}; process.stdout.write(logger.transports.map((transport) => transport.constructor.name).join(","));`
    ],
    {
        cwd: probeDirectory,
        env: {
            ...process.env,
            APP_ENV: "production",
            NODE_ENV: "production",
            VERCEL: "1",
            LOG_DIR: path.join(probeDirectory, "logs")
        },
        encoding: "utf8"
    }
);

try {
    assert.equal(loggerProbe.status, 0, loggerProbe.stderr);
    assert.equal(loggerProbe.stdout, "DailyRotateFile,Console");
    assert.equal(existsSync(path.join(probeDirectory, "logs")), true);
} finally {
    rmSync(probeDirectory, { recursive: true, force: true });
}

console.log(
    "Reliability unit tests passed: expiry validation, analytics failure handling, and dual deployed logging."
);
