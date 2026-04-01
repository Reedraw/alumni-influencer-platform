const cron = require("node-cron");
const { getDatabase } = require("../lib/database");
const tokens = require("../queries/tokens");
const apiTokens = require("../queries/apiTokens");

/**
 * Token cleanup job.
 * Runs every hour to clean up:
 * 1. Expired email verification tokens
 * 2. Expired password reset tokens
 * 3. Expired API tokens
 */
function startCleanupJob() {
    // Run every hour
    cron.schedule("0 * * * *", async () => {
        console.log("[Cleanup] Running token cleanup...");

        try {
            const db = getDatabase();

            await tokens.cleanupExpiredTokens(db);
            console.log(
                "[Cleanup] Expired verification/reset " +
                "tokens cleaned"
            );

            await apiTokens.cleanupExpiredApiTokens(db);
            console.log(
                "[Cleanup] Expired API tokens deactivated"
            );
        } catch (error) {
            console.error("[Cleanup] Error:", error);
        }
    });

    console.log("Token cleanup job scheduled (hourly)");
}

module.exports = { startCleanupJob };
