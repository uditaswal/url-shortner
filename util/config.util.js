import dotenv from "dotenv";

dotenv.config({ path: ".env" });

const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "test";
const isProduction = appEnv === "production";
const envPrefix = isProduction ? "PROD" : "TEST";

function getRequiredEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}`);
    }

    return value.trim();
}

const config = {
    appEnv,
    isProduction,
    port: Number(process.env.PORT || 8000),
    jwtSecretKey: getRequiredEnv(`${envPrefix}_JWT_SECRET_KEY`),
    db: {
        url: getRequiredEnv(`${envPrefix}_DB_URL`),
        name: getRequiredEnv(`${envPrefix}_DB_NAME`),
        accountLabel: process.env[`${envPrefix}_DB_ACCOUNT`] || envPrefix.toLowerCase()
    }
};

export default config;
