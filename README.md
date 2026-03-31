# URL Shortener

A full-stack URL shortener built with **Node.js, Express, MongoDB, and EJS**.

This project feature includes:
- guest mode URL creation
- username-based authentication
- private per-user dashboards
- profile analytics
- structured logging
- rate limiting and security hardening
- integration testing


## Key Features

### URL Shortening
- Create short URLs for long links
- Reuse an existing short URL for duplicate submissions by the same owner
- Public redirect support via short IDs
- Validation for `http://` and `https://` URLs before storing

### Guest Mode
- Guests can shorten URLs without creating an account
- Guest-created links are not shown in a personal dashboard
- UI clearly prompts guests to sign up or log in for dashboard access

### Authentication
- Signup and login use a **unique username** instead of email
- Passwords are hashed with `bcrypt` before being stored
- Legacy plain-text password login path was handled during transition
- Auth is stored in an HTTP-only cookie using JWT

### User Dashboard
- Logged-in users only see **their own URLs**
- Dashboard supports:
  - search by short ID or original URL
  - filter by active/inactive links
  - sort by newest, clicks, short ID, or original URL
  - ascending / descending ordering
- Profile page shows:
  - total URLs
  - total clicks
  - active URLs
  - country-based click stats

### Logging and Monitoring
- Daily rotating log files with Winston
- Structured JSON logs for:
  - app events
  - console output
  - request/response activity
  - application errors
  - process-level failures

### Security
- `helmet` for secure HTTP headers
- `express-rate-limit` for auth and URL creation routes
- input sanitization and validation
- NoSQL/operator-injection protection
- Mongoose filter sanitization
- short ID validation before database queries

### Testing
- Integration test flow covering one complete URL lifecycle
- Validates:
  - guest home access
  - signup
  - login
  - URL creation
  - redirect
  - analytics
  - profile dashboard
  - logout

## Tech Stack

- Node.js
- Express.js
- MongoDB + Mongoose
- EJS
- JWT
- bcrypt
- Winston
- Helmet
- express-rate-limit
- Supertest

## Project Structure

```text
controller/   Route logic
middleware/   Auth, logging, rate limiting, error handling
model/        Mongoose schemas
routes/       Express route definitions
util/         Config, auth, logger, validation helpers
views/        EJS templates
public/       Static assets
test/         Integration test
```

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Use [`.env.example`](./.env.example) as a reference.

Important variables:

```env
PORT=3000
APP_ENV=test

TEST_DB_URL=mongodb://127.0.0.1:27017/
TEST_DB_NAME=url-shortner
TEST_DB_ACCOUNT=local-test-user
TEST_JWT_SECRET_KEY=your-secret

PROD_DB_URL=mongodb://127.0.0.1:27017/
PROD_DB_NAME=url-shortner-prod
PROD_DB_ACCOUNT=local-prod-user
PROD_JWT_SECRET_KEY=your-production-secret
```

### 3. Start the app

```bash
npm start
```

### 4. Run tests

```bash
npm test
```
