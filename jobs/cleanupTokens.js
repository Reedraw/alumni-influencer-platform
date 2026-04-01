// node-cron library for scheduling recurring tasks with cron syntax
const cron = require("node-cron");
// Database connection pool accessor
const { getDatabase } = require("../lib/database");
// Query functions for email verification and password reset token cleanup
const tokens = require("../queries/tokens");
// Query functions for API token cleanup (deactivating expired tokens)
const apiTokens = require("../queries/apiTokens");

/**
 * Token cleanup job.
 * Runs every hour to clean up expired tokens and prevent database bloat:
 * 1. Expired email verification tokens (24-hour expiry)
 * 2. Expired password reset tokens (1-hour expiry)
 * 3. Expired API tokens (deactivated, not deleted)
 */
function startCleanupJob() {
    // Schedule with cron expression: minute 0, every hour, every day/month/weekday
    cron.schedule("0 * * * *", async () => {
        console.log("[Cleanup] Running token cleanup...");

        try {
            const db = getDatabase();

            // Delete expired email verification and password reset tokens
            await tokens.cleanupExpiredTokens(db);
            console.log(
                "[Cleanup] Expired verification/reset " +
                "tokens cleaned"
            );

            // Deactivate (not delete) expired API tokens to preserve audit trail
            await apiTokens.cleanupExpiredApiTokens(db);
            console.log(
                "[Cleanup] Expired API tokens deactivated"
            );
        } catch (error) {
            console.error("[Cleanup] Error:", error);
        }
    });

    // Log that the job has been scheduled on server startup
    console.log("Token cleanup job scheduled (hourly)");
}

// Export the function for initialisation in app.js
module.exports = { startCleanupJob };
