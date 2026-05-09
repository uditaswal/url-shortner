# URL Shortener

A full-stack URL shortener built with Node.js, Express, MongoDB, and EJS. The app supports both a browser UI and a JSON API, with legacy EJS-era routes still available as compatibility aliases during the transition.

## Highlights

- Guest and authenticated URL shortening
- Per-user dashboards with filtering, sorting, and profile analytics
- Admin moderation for disabled or expired links
- Cookie-based auth with hashed passwords
- Security hardening with Helmet, rate limiting, and input validation
- Swagger-backed API documentation
- Mongo-backed integration testing

## Route Layout

The app now uses three route groups:

- `/api/*` for REST and JSON responses
- `/ui/*` for browser pages and HTML form submissions
- legacy routes like `/`, `/profile`, `/login`, `/user/*`, and old form-style `/api/*` posts as compatibility paths

Canonical examples:

- `GET /api/health`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/urls`
- `GET /api/urls/:shortId/analytics`
- `PATCH /api/admin/urls/:shortId/moderation`
- `GET /ui`
- `GET /ui/login`
- `GET /ui/signup`
- `GET /ui/profile`
- `POST /ui/urls`

## Features

### URL Shortening

- Create short URLs for long links
- Reuse an existing short URL for duplicate submissions by the same owner
- Support custom short IDs and optional expiration
- Redirect publicly through `/:shortId`

### Authentication

- Signup and login use a unique username
- Passwords are hashed with `bcrypt`
- Auth is stored in an HTTP-only cookie

### Dashboard And Analytics

- Logged-in users only see their own URLs
- Dashboard supports search, status filters, sort fields, and ordering
- Profile view shows total URLs, active URLs, click totals, bot-filtered counts, and country stats
- Admins can disable or re-enable links from the moderation view

### Security And Reliability

- `helmet` for secure headers and CSP
- `express-rate-limit` on auth and URL creation flows
- Input sanitization and validation helpers
- Request logging and process/app error logging
- Integration test covering the main URL lifecycle

## Tech Stack

- Node.js
- Express.js
- MongoDB + Mongoose
- EJS
- JWT
- bcrypt
- Helmet
- Winston
- Supertest

## Project Structure

```text
controller/   Route handlers
middleware/   Auth, logging, rate limiting, and error handling
model/        Mongoose schemas
routes/       API, UI, and legacy-compatible route modules
util/         Config, auth, logger, and validation helpers
views/        EJS templates
public/       Static assets
test/         Integration test coverage
```

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Use [`.env.example`](./.env.example) as the baseline.

```env
PORT=3000
APP_ENV=production

TEST_DB_URL=<endpoint>
TEST_DB_NAME=url-shortner
TEST_DB_ACCOUNT=local-test-user
TEST_JWT_SECRET_KEY=your-secret

PROD_DB_URL=<endpoint>
PROD_DB_NAME=url-shortner-prod
PROD_DB_ACCOUNT=local-prod-user
PROD_JWT_SECRET_KEY=your-production-secret
```

### 3. Start the app

```bash
npm start
```

### 4. Run the integration test

```bash
npm test
```

## API Documentation

Swagger UI is available at [http://domain/api/api-docs](http://domain/api/api-docs).

The documented API covers:

- auth endpoints under `/api/auth/*`
- URL creation, update, delete, analytics, and moderation under `/api/*`
- dashboard JSON endpoints like `/api/dashboard`
- health checks via `/api/health`

Example health check:

```bash
curl <url>/api/health
```

```json
{
    "status": "UP",
    "timestamp": "2026-05-09T12:00:00.000Z"
}
```
