const crypto = require("crypto");

/**
 * Generate a secure random token
 * @returns {string} Hex-encoded random token
 */
function generateToken() {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a token using SHA256
 * @param {string} token - Raw token
 * @returns {string} Hex-encoded hash
 */
function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Send verification email (logs to console in development)
 * @param {string} email - Recipient email
 * @param {string} token - Raw verification token
 */
function sendVerificationEmail(email, token) {
    const verificationUrl =
        `http://localhost:3000/verify-email?token=${token}`;
    console.log("\n========== VERIFICATION EMAIL ==========");
    console.log(`To: ${email}`);
    console.log(`Verification URL: ${verificationUrl}`);
    console.log("=========================================\n");
}

/**
 * Send password reset email (logs to console in development)
 * @param {string} email - Recipient email
 * @param {string} token - Raw reset token
 */
function sendPasswordResetEmail(email, token) {
    const resetUrl =
        `http://localhost:3000/reset-password?token=${token}`;
    console.log("\n========== PASSWORD RESET EMAIL ==========");
    console.log(`To: ${email}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log("==========================================\n");
}

/**
 * Send bid status notification email (logs to console in development)
 * @param {string} email - Recipient email
 * @param {string} status - Bid status (winning/losing/won)
 * @param {string} cycleDate - Date of the bidding cycle
 */
function sendBidStatusEmail(email, status, cycleDate) {
    console.log("\n========== BID STATUS EMAIL ==========");
    console.log(`To: ${email}`);
    console.log(`Status: ${status}`);
    console.log(`Cycle Date: ${cycleDate}`);
    console.log("======================================\n");
}

module.exports = {
    generateToken,
    hashToken,
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendBidStatusEmail,
};
