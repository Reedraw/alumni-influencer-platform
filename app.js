require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const crypto = require("crypto");
const path = require("path");
const swaggerUi = require("swagger-ui-express");

const { createSessionMiddleware } = require("./lib/session");
const swaggerSpec = require("./lib/swagger");

// Routes
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const bidRoutes = require("./routes/bidRoutes");
const apiRoutes = require("./routes/apiRoutes");
const apiKeyRoutes = require("./routes/apiKeyRoutes");

const app = express();

// Security headers
app.use(helmet({
    contentSecurityPolicy: false,
}));

// Request logging
app.use(morgan("dev"));

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Parse form data and JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Sessions
app.use(createSessionMiddleware());

// CSRF token and user locals for all views
app.use((req, res, next) => {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto
            .randomBytes(32)
            .toString("hex");
    }
    res.locals.csrfToken = req.session.csrfToken;
    res.locals.user = req.session.user || null;
    next();
});

// Swagger API documentation
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use(authRoutes);
app.use("/profile", profileRoutes);
app.use("/bids", bidRoutes);
app.use("/api", apiRoutes);
app.use("/api-keys", apiKeyRoutes);

// Home page redirect
app.get("/", (req, res) => {
    if (req.session.user) {
        return res.redirect("/profile");
    }
    res.redirect("/login");
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    if (req.path.startsWith("/api/")) {
        return res.status(500).json({ error: "Internal server error" });
    }
    res.status(500).send("Something went wrong");
});

// Start server only when run directly
if (require.main === module) {
    const { connectToDb } = require("./lib/database");
    const { startBiddingCycleJob } = require("./jobs/biddingCycle");
    const { startCleanupJob } = require("./jobs/cleanupTokens");

    async function startServer() {
        try {
            await connectToDb();
            console.log("Database connected");

            startBiddingCycleJob();
            startCleanupJob();

            const port = process.env.PORT || 3000;
            app.listen(port, () => {
                console.log(
                    `Server running at http://localhost:${port}`
                );
            });
        } catch (error) {
            console.error("Failed to start server:", error);
            process.exit(1);
        }
    }

    startServer();
}

module.exports = app;