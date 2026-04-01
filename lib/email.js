// Node.js built-in crypto module for secure random generation and hashing
const crypto = require("crypto");

/**
 * Generate a cryptographically secure random token.
 * Used for email verification and password reset tokens.
 * @returns {string} 64-character hex-encoded random token
 */
function generateToken() {
    // Generate 32 random bytes (256 bits of entropy) and convert to hex string
    return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a token using SHA256 for secure storage in the database.
 * Raw tokens are never stored - only their hashes.
 * @param {string} token - Raw token to hash
 * @returns {string} 64-character hex-encoded SHA256 hash
 */
function hashToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Send verification email to a newly registered user.
 * In development, logs to console instead of sending real emails.
 * In production, this would integrate with an SMTP service (e.g. SendGrid).
 * @param {string} email - Recipient email address
 * @param {string} token - Raw verification token (included in URL)
 */
function sendVerificationEmail(email, token) {
    // Build the verification URL with the raw token as a query parameter
    const verificationUrl =
        `http://localhost:3000/verify-email?token=${token}`;
    // Log email content to console (simulates email sending in development)
    console.log("\n========== VERIFICATION EMAIL ==========");
    console.log(`To: ${email}`);
    console.log(`Verification URL: ${verificationUrl}`);
    console.log("=========================================\n");
}

/**
 * Send password reset email with a secure reset link.
 * In development, logs to console instead of sending real emails.
 * @param {string} email - Recipient email address
 * @param {string} token - Raw reset token (included in URL)
 */
function sendPasswordResetEmail(email, token) {
    // Build the reset URL with the raw token as a query parameter
    const resetUrl =
        `http://localhost:3000/reset-password?token=${token}`;
    // Log email content to console (simulates email sending in development)
    console.log("\n========== PASSWORD RESET EMAIL ==========");
    console.log(`To: ${email}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log("==========================================\n");
}

/**
 * Send bid status notification email to inform users about their bid outcome.
 * Notifies users when their bid is placed, updated, won, or lost.
 * @param {string} email - Recipient email address
 * @param {string} status - Bid status message (e.g. "won", "lost", "Bid placed")
 * @param {string} cycleDate - The date of the bidding cycle (YYYY-MM-DD)
 */
function sendBidStatusEmail(email, status, cycleDate) {
    // Log email content to console (simulates email sending in development)
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
