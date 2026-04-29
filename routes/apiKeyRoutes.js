// Express framework for creating modular route handlers
const express = require("express");
// Create a new router instance for API key management routes
const router = express.Router();

// Database connection pool accessor
const { getDatabase } = require("../lib/database");
// Session authentication middleware — redirects to login if not authenticated
const { requireAuth } = require("../middleware/auth");
// CSRF protection middleware to prevent cross-site request forgery
const { csrfProtection } = require("../lib/csrf");
// Database query functions for API token CRUD and analytics
const apiTokens = require("../queries/apiTokens");

// Apply session authentication to ALL API key management routes
router.use(requireAuth);

// ==================== LIST API KEYS ====================

// GET /api-keys — Display the API key management page with all user tokens
router.get("/", async (req, res) => {
    try {
        const db = getDatabase();
        // Fetch all API tokens belonging to the logged-in user
        const tokenList = await apiTokens.getApiTokensByUserId(
            db, req.session.user.id
        );

        // Render the management page with token list and empty state for other fields
        res.render("api-keys/manage", {
            tokens: tokenList,
            newToken: null,     // Only set when a new token was just generated
            errors: [],
            stats: null,        // Only set when viewing a specific token's stats
            logs: null,         // Only set when viewing a specific token's request log
            selectedTokenId: null,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// ==================== GENERATE API KEY ====================

// POST /api-keys/generate — Create a new API token with a user-provided name
router.post("/generate", csrfProtection, async (req, res) => {
    try {
        const db = getDatabase();
        const { token_name } = req.body;

        // Validate that a token name was provided
        if (!token_name || !token_name.trim()) {
            const tokenList = await apiTokens.getApiTokensByUserId(
                db, req.session.user.id
            );
            return res.status(400).render("api-keys/manage", {
                tokens: tokenList,
                newToken: null,
                errors: ["Token name is required"],
                stats: null,
                logs: null,
                selectedTokenId: null,
            });
        }

        // Parse permissions from checkboxes (req.body.permissions is an array or string or undefined)
        const rawPerms = req.body.permissions;
        const permissionsArray = Array.isArray(rawPerms)
            ? rawPerms
            : rawPerms
            ? [rawPerms]
            : [];

        // Default to least-privilege scope if nothing selected
        const permissions = permissionsArray.length > 0
            ? permissionsArray
            : ["read:alumni_of_day"];

        // Create the token — returns the raw token (shown once) and its DB id
        // The raw token is SHA256-hashed before storage; only the hash is stored
        const { id, rawToken } = await apiTokens.createApiToken(db, {
            userId: req.session.user.id,
            tokenName: token_name.trim(),
            permissions,
            expiresAt: null, // Non-expiring token by default
        });

        // Re-fetch the full token list to display alongside the new raw token
        const tokenList = await apiTokens.getApiTokensByUserId(
            db, req.session.user.id
        );

        // Render with rawToken so the user can copy it (shown only once)
        res.render("api-keys/manage", {
            tokens: tokenList,
            newToken: rawToken, // IMPORTANT: This is the only time the raw token is visible
            errors: [],
            stats: null,
            logs: null,
            selectedTokenId: null,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// ==================== REVOKE API KEY ====================

// POST /api-keys/:id/revoke — Revoke (deactivate) an API token
router.post("/:id/revoke", csrfProtection, async (req, res) => {
    try {
        const db = getDatabase();

        // SECURITY: Verify the token belongs to the logged-in user before revoking
        const token = await apiTokens.getApiTokenById(
            db, req.params.id
        );
        if (!token || token.user_id !== req.session.user.id) {
            return res.status(403).send("Forbidden");
        }

        // Mark the token as revoked in the database
        await apiTokens.revokeApiToken(db, req.params.id);
        res.redirect("/api-keys");
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// ==================== VIEW KEY STATS ====================

// GET /api-keys/:id/stats — Display usage statistics and request log for a token
router.get("/:id/stats", async (req, res) => {
    try {
        const db = getDatabase();

        // SECURITY: Verify the token belongs to the logged-in user before showing stats
        const token = await apiTokens.getApiTokenById(
            db, req.params.id
        );
        if (!token || token.user_id !== req.session.user.id) {
            return res.status(403).send("Forbidden");
        }

        // Get aggregate statistics (total requests, last used, etc.)
        const stats = await apiTokens.getApiTokenStats(
            db, req.params.id
        );
        // Get detailed request log (recent API calls with timestamps and endpoints)
        const logs = await apiTokens.getApiTokenRequestLog(
            db, req.params.id
        );
        // Re-fetch token list for the page layout
        const tokenList = await apiTokens.getApiTokensByUserId(
            db, req.session.user.id
        );

        // Render the management page with stats section active for this token
        res.render("api-keys/manage", {
            tokens: tokenList,
            newToken: null,
            errors: [],
            stats,
            logs,
            selectedTokenId: req.params.id, // Highlights the selected token in the UI
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// Export the router for mounting in app.js
module.exports = router;
