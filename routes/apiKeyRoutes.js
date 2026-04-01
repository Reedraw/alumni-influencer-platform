const express = require("express");
const router = express.Router();

const { getDatabase } = require("../lib/database");
const { requireAuth } = require("../middleware/auth");
const { csrfProtection } = require("../lib/csrf");
const apiTokens = require("../queries/apiTokens");

// All API key management routes require session authentication
router.use(requireAuth);

// ==================== LIST API KEYS ====================

router.get("/", async (req, res) => {
    try {
        const db = getDatabase();
        const tokenList = await apiTokens.getApiTokensByUserId(
            db, req.session.user.id
        );

        res.render("api-keys/manage", {
            tokens: tokenList,
            newToken: null,
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

// ==================== GENERATE API KEY ====================

router.post("/generate", csrfProtection, async (req, res) => {
    try {
        const db = getDatabase();
        const { token_name } = req.body;

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

        const { id, rawToken } = await apiTokens.createApiToken(db, {
            userId: req.session.user.id,
            tokenName: token_name.trim(),
            expiresAt: null,
        });

        const tokenList = await apiTokens.getApiTokensByUserId(
            db, req.session.user.id
        );

        res.render("api-keys/manage", {
            tokens: tokenList,
            newToken: rawToken,
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

router.post("/:id/revoke", csrfProtection, async (req, res) => {
    try {
        const db = getDatabase();

        // Verify ownership
        const token = await apiTokens.getApiTokenById(
            db, req.params.id
        );
        if (!token || token.user_id !== req.session.user.id) {
            return res.status(403).send("Forbidden");
        }

        await apiTokens.revokeApiToken(db, req.params.id);
        res.redirect("/api-keys");
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// ==================== VIEW KEY STATS ====================

router.get("/:id/stats", async (req, res) => {
    try {
        const db = getDatabase();

        // Verify ownership
        const token = await apiTokens.getApiTokenById(
            db, req.params.id
        );
        if (!token || token.user_id !== req.session.user.id) {
            return res.status(403).send("Forbidden");
        }

        const stats = await apiTokens.getApiTokenStats(
            db, req.params.id
        );
        const logs = await apiTokens.getApiTokenRequestLog(
            db, req.params.id
        );
        const tokenList = await apiTokens.getApiTokensByUserId(
            db, req.session.user.id
        );

        res.render("api-keys/manage", {
            tokens: tokenList,
            newToken: null,
            errors: [],
            stats,
            logs,
            selectedTokenId: req.params.id,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

module.exports = router;
