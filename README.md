# Alumni Influencers

A web application for university alumni engagement built for the University of Eastminster. Alumni register, build professional profiles, and participate in a daily blind bidding system to become the featured **Alumni of the Day** — a 24-hour spotlight visible to all students via a public API.

## Features

- **Registration & Authentication** — Email-based registration (university domain only), email verification with secure tokens, login/logout with sessions, password reset flow
- **Alumni Profiles** — Biography, LinkedIn URL, profile image upload, degrees, certifications, licences, short courses, and employment history (all with full CRUD)
- **Blind Bidding System** — Place bids without seeing the highest bid, increase-only updates, win/lose status feedback, monthly limit enforcement (3 wins/month, 4 with event attendance), automated 6 PM winner selection
- **API Key Management** — Generate/revoke bearer tokens, view usage statistics and request logs per key
- **Public Developer API** — `GET /api/featured-alumni` for today's Alumni of the Day, `GET /api/featured-alumni/history` for past winners, full Swagger documentation at `/api-docs`
- **Security** — Bcrypt password hashing (12 rounds), Helmet HTTP headers, CSRF protection, rate limiting, parameterized SQL queries, input validation/sanitisation, SHA-256 token hashing, auth audit logging

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
  rate-limit.js         # In-memory rate limiter
routes/
  authRoutes.js         # Register, login, verify, reset password
  profileRoutes.js      # Profile CRUD with all sub-sections
  bidRoutes.js          # Place/update bids, view dashboard
  apiRoutes.js          # Public featured alumni endpoints
  apiKeyRoutes.js       # API key management
queries/
  users.js              # User CRUD operations
  tokens.js             # Verification & reset token queries
  profiles.js           # Profile & sub-section queries
  bids.js               # Bidding cycle & bid queries
  apiTokens.js          # API token queries & request logging
  audit.js              # Auth audit log queries
middleware/
  auth.js               # Session authentication guard
  apiAuth.js            # Bearer token authentication
  validation.js         # Validation error extraction
models/
  authSchema.js         # Registration, login, reset validation
  profileSchema.js      # Profile sub-section validation
  bidSchema.js          # Bid amount validation
views/
  auth/                 # Register, login, verify, forgot/reset password
  profile/              # Create, view, edit profile
  bids/                 # Dashboard, place bid
  api-keys/             # Key management with stats/logs
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

| Variable | Description |
|----------|-------------|
| `DB_HOST` | MySQL host (default: `localhost`) |
| `DB_PORT` | MySQL port (default: `3306`) |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name (default: `alumni_influencers`) |
| `PORT` | Server port (default: `3000`) |
| `SESSION_SECRET` | Long random string for session signing |
| `JWT_SECRET` | Long random string for JWT signing |
| `ALLOWED_EMAIL_DOMAIN` | Permitted email domain for registration (e.g. `eastminster.ac.uk`) |

## Scripts

```bash
npm run dev     # Start with nodemon (auto-restart on changes)
npm start       # Start production server
npm test        # Run all tests (Jest)
```

## API Documentation

Interactive Swagger docs are available at `/api-docs` when the server is running.

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/featured-alumni` | Bearer token | Today's Alumni of the Day |
| `GET` | `/api/featured-alumni/history` | Bearer token | Past featured alumni |

## Testing

75 tests across 4 test suites covering:

- Auth routes — registration, email verification, login/logout, password reset, validation errors
- Profile routes — CRUD operations, authentication guards, sub-section management
- Bidding routes — bid placement, increase-only updates, cycle/limit enforcement
- API routes — bearer token auth, featured alumni endpoints, API key management, ownership checks

```bash
npm test
```
