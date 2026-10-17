# URL Shortener

A full-stack URL shortener with a server-rendered browser experience and a documented JSON API. It supports guest links, authenticated dashboards, expiration controls, analytics, moderation, and public trust-and-safety pages.

## Key Project Metrics

These are implementation metrics from the repository, not production traffic claims:

- **2 access modes:** guest shortening and authenticated account management
- **3 route surfaces:** REST API, browser UI, and legacy compatibility routes
- **5 dashboard signals:** total links, human visits, active links, excluded bot visits, and country distribution
- **4 management controls:** search, status filter, sort field, and sort order
- **4 public safety pages:** Privacy Notice, Terms of Service, Acceptable Use, and Report Abuse
- **1 end-to-end integration scenario:** authentication, link creation, redirect, analytics, updates, moderation, and deletion

## Features

### Link Management

- Shorten a destination URL as a guest or signed-in user
- Choose a custom alias or let the app generate one
- Set an optional expiration date and time
- Reuse an existing short URL for a duplicate destination owned by the same user
- Edit, disable, re-enable, or delete saved links
- Redirect visitors through `/:shortId`

### Accounts and Access

- Sign up and sign in with a unique username
- Secure password hashing and signed authentication tokens
- Account-scoped dashboards so users only manage their own links
- Role-protected moderation tools for administrators

### Dashboard and Analytics

- Search saved links and filter them by status
- Sort results by supported fields and direction
- Track human visits separately from detected bot traffic
- View active-link totals, visit counts, and country distribution
- Inspect analytics through both the browser UI and JSON API

### Safety and Reliability

- Security headers and Content Security Policy through Helmet
- Rate limits on authentication and link-creation flows
- Server-side validation and sanitisation
- Centralised request, application, and process-error logging
- Link expiration and administrator moderation
- Public policies and an abuse-reporting path
- Health check and database connectivity check

### Developer Experience

- Swagger UI for API discovery
- EJS server-rendered pages with shared layouts and styling
- Clear API, UI, and legacy route separation
- ESLint, Prettier, Nodemon, and Supertest tooling
- Environment-specific test and production configuration

## Architecture

```text
Browser / API client
        |
Express route modules
        |
Authentication, validation, rate limiting, and logging middleware
        |
Controllers and service utilities
        |
Mongoose models
        |
MongoDB
```

The app exposes three route groups:

- `/api/*` returns REST and JSON responses
- `/ui/*` renders browser pages and handles HTML forms
- Legacy paths such as `/`, `/profile`, `/login`, and `/user/*` remain as compatibility aliases

Canonical route examples:

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

## Tech Stack

### Application

- Node.js 20+
- Express 5
- EJS
- MongoDB and Mongoose

### Authentication and Security

- JSON Web Tokens
- bcrypt
- Helmet
- express-rate-limit

### Observability and Documentation

- Winston with rotating log files
- Swagger UI and OpenAPI annotations

### Development and Testing

- pnpm
- Nodemon
- ESLint and Prettier
- Supertest

## Run Locally

### Prerequisites

- Node.js 20 or later
- pnpm
- A local MongoDB server or MongoDB Atlas connection string

If pnpm is not installed, enable it through Corepack:

```bash
corepack enable
```

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Create the Environment File

Copy [`.env.example`](./.env.example) to `.env`.

PowerShell:

```powershell
Copy-Item .env.example .env
```

macOS or Linux:

```bash
cp .env.example .env
```

Configure the environment values:

```env
PORT=3000
APP_ENV=test

TEST_DB_URL=mongodb://127.0.0.1:27017/
TEST_DB_NAME=url-shortner-test
TEST_DB_ACCOUNT=local-test-user
TEST_JWT_SECRET_KEY=replace-with-a-long-random-secret

PROD_DB_URL=mongodb://127.0.0.1:27017/
PROD_DB_NAME=url-shortner-prod
PROD_DB_ACCOUNT=local-prod-user
PROD_JWT_SECRET_KEY=replace-with-a-different-production-secret
```

For a hosted MongoDB deployment, replace the relevant database URL with its connection string. When `APP_ENV=test`, the app reads the `TEST_*` variables. When `APP_ENV=production`, it reads the `PROD_*` variables.

### 3. Check the Database Connection

```bash
pnpm db:check
```

A successful check prints the connected database and host.

### 4. Start the App

Development mode with automatic restarts:

```bash
pnpm dev
```

Normal start:

```bash
pnpm start
```

The terminal confirms the local address:

```text
URL Shortener started at http://localhost:3000/
```

Open:

- App: [http://localhost:3000](http://localhost:3000)
- API documentation: [http://localhost:3000/api/api-docs](http://localhost:3000/api/api-docs)
- Health check: [http://localhost:3000/api/health](http://localhost:3000/api/health)

### 5. Run Project Checks

```bash
pnpm lint
pnpm test
```

The integration scenario uses the configured test database and deletes URL, user, and rate-limit records in `TEST_DB_NAME` before and after it runs. Always point it at a dedicated disposable test database.

## Useful Commands

- `pnpm dev` starts the development server with automatic restarts
- `pnpm start` starts the application normally
- `pnpm db:check` verifies database connectivity without changing data
- `pnpm lint` checks JavaScript and EJS files
- `pnpm lint:fix` applies supported lint fixes
- `pnpm format` formats supported source files
- `pnpm test` runs the MongoDB-backed integration scenario

## API Documentation

Swagger UI is available at [http://localhost:3000/api/api-docs](http://localhost:3000/api/api-docs) while the app is running. It documents authentication, URL lifecycle, analytics, moderation, dashboard, and health endpoints.

Example health check:

```bash
curl http://localhost:3000/api/health
```

```json
{
    "status": "UP",
    "timestamp": "2026-05-09T12:00:00.000Z"
}
```

## Project Structure

```text
controller/   Route handlers
middleware/   Authentication, logging, rate limiting, and error handling
model/        Mongoose schemas
routes/       API, UI, and legacy-compatible route modules
util/         Configuration, authentication, logging, and validation helpers
views/        EJS templates
public/       Static assets
test/         Integration coverage
```
