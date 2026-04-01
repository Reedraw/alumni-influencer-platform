// Load environment variables from .env file into process.env
require("dotenv").config();

// Import external dependencies
const express = require("express"); // Web framework for Node.js
const helmet = require("helmet"); // Sets secure HTTP response headers
const morgan = require("morgan"); // HTTP request logger middleware
const crypto = require("crypto"); // Node.js built-in cryptography module
const path = require("path"); // Node.js built-in path utilities
const swaggerUi = require("swagger-ui-express"); // Serves Swagger UI for API docs

// Import internal modules
const { createSessionMiddleware } = require("./lib/session"); // Session configuration
const swaggerSpec = require("./lib/swagger"); // OpenAPI specification object

// Import route handlers for each feature area
const authRoutes = require("./routes/authRoutes"); // Login, register, password reset
const profileRoutes = require("./routes/profileRoutes"); // Alumni profile CRUD
const bidRoutes = require("./routes/bidRoutes"); // Blind bidding system
const apiRoutes = require("./routes/apiRoutes"); // Public API for featured alumni
const apiKeyRoutes = require("./routes/apiKeyRoutes"); // API key management

// Create the Express application instance
const app = express();

// Apply Helmet for secure HTTP headers (CSP disabled to allow inline EJS styles)
app.use(helmet({
    contentSecurityPolicy: false,
}));

// Log all HTTP requests in development format (method, url, status, response time)
app.use(morgan("dev"));

// Configure EJS as the template engine for server-side rendering
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); // Set views directory path

// Parse URL-encoded form bodies (from HTML forms)
app.use(express.urlencoded({ extended: true }));
// Parse JSON request bodies (from API clients)
app.use(express.json());

// Serve static files from the public directory (CSS, JS, images)
app.use(express.static(path.join(__dirname, "public")));
// Serve uploaded files (profile images) from the uploads directory
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Enable session middleware for user authentication state
app.use(createSessionMiddleware());

// Middleware to generate CSRF tokens and expose user data to all EJS views
app.use((req, res, next) => {
    // Generate a CSRF token if one doesn't exist in the session yet
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto
            .randomBytes(32) // 32 cryptographically random bytes
            .toString("hex"); // Convert to 64-character hex string
    }
    // Make CSRF token available to all EJS templates via res.locals
    res.locals.csrfToken = req.session.csrfToken;
    // Make the logged-in user object available to all templates (or null if not logged in)
    res.locals.user = req.session.user || null;
    next();
});

// Mount Swagger UI at /api-docs for interactive API documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Mount route handlers at their respective URL prefixes
app.use(authRoutes); // Auth routes mounted at root (e.g. /login, /register)
app.use("/profile", profileRoutes); // Profile routes under /profile/*
app.use("/bids", bidRoutes); // Bidding routes under /bids/*
app.use("/api", apiRoutes); // Public API routes under /api/*
app.use("/api-keys", apiKeyRoutes); // API key management under /api-keys/*

// Home page - redirect authenticated users to profile, others to login
app.get("/", (req, res) => {
    if (req.session.user) {
        return res.redirect("/profile");
    }
    res.redirect("/login");
});

// Global error handler middleware (catches unhandled errors from routes)
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the full error stack trace
    // Return JSON error for API routes, HTML for web routes
    if (req.path.startsWith("/api/")) {
        return res.status(500).json({ error: "Internal server error" });
    }
    res.status(500).send("Something went wrong");
});

// Only start the server when this file is run directly (not when imported for testing)
if (require.main === module) {
    const { connectToDb } = require("./lib/database"); // Database connection pool
    const { startBiddingCycleJob } = require("./jobs/biddingCycle"); // Daily 6 PM cron job
    const { startCleanupJob } = require("./jobs/cleanupTokens"); // Hourly token cleanup

    async function startServer() {
        try {
            // Establish MySQL connection pool before accepting requests
            await connectToDb();
            console.log("Database connected");

            // Start scheduled background jobs
            startBiddingCycleJob(); // Selects daily bidding winner at 6 PM
            startCleanupJob(); // Removes expired tokens every hour

            // Start listening for HTTP requests
            const port = process.env.PORT || 3000;
            app.listen(port, () => {
                console.log(
                    `Server running at http://localhost:${port}`
                );
            });
        } catch (error) {
            console.error("Failed to start server:", error);
            process.exit(1); // Exit with error code if startup fails
        }
    }

    startServer();
}

// Export app for use in tests (supertest)
module.exports = app;