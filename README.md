# Alumni Influencers

A web application for university alumni engagement built for the University of Eastminster. Alumni register, build professional profiles, and participate in a daily blind bidding system to become the featured **Alumni of the Day** — a 24-hour spotlight visible to all students via a public API.

This is **Part 1** of a two-part system. Part 2 ([Alumni Dashboard](../Alumni_Dashboard/README.md)) is a separate client application that consumes this API to provide analytics intelligence to university staff.

## Features

- **Registration & Authentication** — Email-based registration (university domain only), email verification with secure tokens, login/logout with sessions, password reset flow
- **Alumni Profiles** — Biography, LinkedIn URL, profile image upload, degrees, certifications, licences, short courses, and employment history (all with full CRUD)
- **Blind Bidding System** — Place bids without seeing the highest bid, increase-only updates, win/lose status feedback, monthly limit enforcement (3 wins/month, 4 with event attendance), automated 6 PM winner selection
- **Scoped API Key Management** — Generate bearer tokens scoped to specific permission sets (`read:alumni_of_day`, `read:alumni`, `read:analytics`), revoke keys, view per-key usage statistics and full request logs
- **Public Developer API** — Featured alumni endpoints plus a full suite of analytics endpoints for the university dashboard, with Swagger documentation at `/api-docs`
- **Security** — Bcrypt password hashing (12 rounds), Helmet HTTP headers, CSRF protection, rate limiting (100 req/15 min), parameterised SQL queries, input validation/sanitisation, SHA-256 token hashing, auth audit logging

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js |
| Framework | Express 5 |
| Templating | EJS |
| Database | MySQL |
| Auth | express-session, bcrypt |
| Validation | express-validator |
| File Uploads | Multer |
| API Docs | swagger-jsdoc, swagger-ui-express |
| Scheduling | node-cron |
| Testing | Jest, Supertest |

## Project Structure

```
app.js                  # Express app entry point
database_setup.sql      # Full database schema (3NF)
lib/
  database.js           # MySQL connection pool
  password.js           # Bcrypt hashing utilities
  session.js            # Session middleware config
  email.js              # Token generation & email simulation
  upload.js             # Multer config (UUID filenames, image filter)
  csrf.js               # CSRF protection middleware
  swagger.js            # OpenAPI specification
  rate-limit.js         # In-memory rate limiter (100 req/15 min per IP)
routes/
  authRoutes.js         # Register, login, verify, reset password
  profileRoutes.js      # Profile CRUD with all sub-sections
  bidRoutes.js          # Place/update bids, view dashboard
  apiRoutes.js          # Public API: featured alumni + analytics endpoints
  apiKeyRoutes.js       # API key management UI
queries/
  users.js              # User CRUD operations
  tokens.js             # Verification & reset token queries
  profiles.js           # Profile & sub-section queries
  bids.js               # Bidding cycle, bid queries, featured alumni history
  apiTokens.js          # API token CRUD, permission storage, request logging
  analytics.js          # Aggregate analytics queries for the dashboard API
  audit.js              # Auth audit log queries
middleware/
  auth.js               # Session authentication guard
  apiAuth.js            # Bearer token auth + permission enforcement
  validation.js         # Validation error extraction
models/
  authSchema.js         # Registration, login, reset validation
  profileSchema.js      # Profile sub-section validation
  bidSchema.js          # Bid amount validation
views/
  auth/                 # Register, login, verify, forgot/reset password
  profile/              # Create, view, edit profile
  bids/                 # Dashboard, place bid
  api-keys/             # Key management with permission badges, stats/logs
jobs/
  biddingCycle.js       # Daily 6 PM winner selection cron
  cleanupTokens.js      # Hourly expired token cleanup cron
tests/
  setup.js              # Test environment config
  auth.test.js          # Auth route tests
  profile.test.js       # Profile route tests
  bidding.test.js       # Bidding route tests
  api.test.js           # API & API key route tests
```

## Prerequisites

- **Node.js** v18+
- **MySQL** 8.0+

## Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd Alumni_Influencers
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your database credentials and secrets.

4. **Create the database**

   ```bash
   mysql -u root -p < database_setup.sql
   ```

   Or run the contents of `database_setup.sql` in your MySQL client.

5. **Start the development server**

   ```bash
   npm run dev
   ```

   The app runs at `http://localhost:3000`.

## Environment Variables

See `.env.example` for a full template with all required variables. Key settings:

| Variable | Description |
|----------|-------------|
| `DB_HOST` | MySQL host (default: `localhost`) |
| `DB_PORT` | MySQL port (default: `3306`) |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name (default: `alumni_influencers`) |
| `PORT` | Server port (default: `3000`) |
| `SESSION_SECRET` | Long random string for session signing |
| `ALLOWED_EMAIL_DOMAIN` | Permitted registration domain (e.g. `eastminster.ac.uk`) |

## Scripts

```bash
npm run dev     # Start with nodemon (auto-restart on changes)
npm start       # Start production server
npm test        # Run all tests (Jest)
```

## API Documentation

Interactive Swagger docs are available at `/api-docs` when the server is running.

All API endpoints require a Bearer token. Tokens are scoped — each key only grants access to the permissions it was issued with.

### Permission Scopes

| Scope | Grants Access To |
|-------|-----------------|
| `read:alumni_of_day` | Featured alumni endpoints (AR app) |
| `read:alumni` | Full alumni list with filters |
| `read:analytics` | All analytics aggregate endpoints |

### Endpoints

| Method | Endpoint | Required Permission | Description |
|--------|----------|---------------------|-------------|
| `GET` | `/api/featured-alumni` | `read:alumni_of_day` | Today's Alumni of the Day with full profile |
| `GET` | `/api/featured-alumni/history` | `read:alumni_of_day` | Past featured alumni (up to 30) |
| `GET` | `/api/alumni` | `read:alumni` | Alumni list, filterable by programme, sector, graduation year |
| `GET` | `/api/analytics/certifications` | `read:analytics` | Top certifications ranked by frequency |
| `GET` | `/api/analytics/courses` | `read:analytics` | Top short courses ranked by frequency |
| `GET` | `/api/analytics/employment` | `read:analytics` | Current employment sectors breakdown |
| `GET` | `/api/analytics/degrees` | `read:analytics` | Degree programme distribution |
| `GET` | `/api/analytics/bidding` | `read:analytics` | Bidding activity trends (last 60 days) |
| `GET` | `/api/analytics/graduation-years` | `read:analytics` | Graduate count by graduation year |

### Generating an API Key

Log in, navigate to **API Keys**, and click **Generate New Key**. Select the permission scopes appropriate for your client:

- **AR / mobile app** — tick `read:alumni_of_day` only
- **University analytics dashboard** — tick `read:alumni` and `read:analytics`

The raw token is shown once on generation. Copy it immediately — only a SHA-256 hash is stored.

## Testing

75 tests across 4 test suites covering:

- Auth routes — registration, email verification, login/logout, password reset, validation errors
- Profile routes — CRUD operations, authentication guards, sub-section management
- Bidding routes — bid placement, increase-only updates, cycle/limit enforcement
- API routes — bearer token auth, featured alumni endpoints, API key management, ownership checks

```bash
npm test
```
