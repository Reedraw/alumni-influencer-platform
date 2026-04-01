// UUID generator for creating unique token record IDs
const { v4: uuidv4 } = require("uuid");

/**
 * Create an email verification token for a newly registered user.
 * The raw token is sent to the user via email; only the SHA256 hash is stored
 * in the database for security (so a database breach won't expose valid tokens).
 * Token expires after 24 hours to limit the verification window.
 * @param {object} db - MySQL connection pool
 * @param {string} userId - UUID of the user who needs to verify their email
 * @param {string} tokenHash - SHA256 hash of the raw token (raw token is emailed)
 * @returns {Promise<string>} The UUID of the newly created token record
 */
async function createEmailVerificationToken(db, userId, tokenHash) {
    const id = uuidv4(); // Generate unique ID for this token record
    // Set expiry to 24 hours from now — user must verify within this window
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Insert the hashed token into the database using parameterised query
    await db.execute(
        `INSERT INTO email_verification_tokens
            (id, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`,
        [id, userId, tokenHash, expiresAt]
    );

    return id;
}

/**
 * Look up a valid (unused + not expired) email verification token by its hash.
 * When a user clicks the verification link, we hash the token from the URL
 * and look it up here. Only returns tokens that haven't been used yet and
 * haven't expired, preventing token reuse and expired token attacks.
 * @param {object} db - MySQL connection pool
 * @param {string} tokenHash - SHA256 hash of the raw token from the verification URL
 * @returns {Promise<object|null>} The token record if valid, or null if invalid/expired
 */
async function getEmailVerificationToken(db, tokenHash) {
    const [rows] = await db.execute(
        `SELECT * FROM email_verification_tokens
         WHERE token_hash = ?
           AND used_at IS NULL
           AND expires_at > NOW()
         LIMIT 1`,
        [tokenHash] // Parameterised to prevent SQL injection
    );

    return rows[0] || null; // Return the token record or null if not found
}

/**
 * Mark an email verification token as used by setting its used_at timestamp.
 * This prevents the same token from being used again (one-time use tokens).
 * Called after the user's email has been successfully verified.
 * @param {object} db - MySQL connection pool
 * @param {string} tokenId - UUID of the token record to mark as used
 */
async function markEmailTokenUsed(db, tokenId) {
    // Set used_at to current time to invalidate the token
    await db.execute(
        `UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?`,
        [tokenId]
    );
}

/**
 * Create a password reset token for a user who forgot their password.
 * Security measures:
 * 1. Invalidates any existing unused reset tokens for this user first,
 *    so only the latest reset link works (prevents parallel reset attacks)
 * 2. Token expires after 1 hour (shorter window than email verification)
 * 3. Only the SHA256 hash is stored; raw token is sent via email
 * @param {object} db - MySQL connection pool
 * @param {string} userId - UUID of the user requesting a password reset
 * @param {string} tokenHash - SHA256 hash of the raw token (raw token is emailed)
 * @returns {Promise<string>} The UUID of the newly created token record
 */
async function createPasswordResetToken(db, userId, tokenHash) {
    const id = uuidv4(); // Generate unique ID for this token record
    // Set expiry to 1 hour from now — short window for security
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    // Invalidate all existing unused reset tokens for this user
    // This ensures only the most recent reset link is valid
    await db.execute(
        `UPDATE password_reset_tokens SET used_at = NOW()
         WHERE user_id = ? AND used_at IS NULL`,
        [userId]
    );

    // Insert the new hashed reset token
    await db.execute(
        `INSERT INTO password_reset_tokens
            (id, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`,
        [id, userId, tokenHash, expiresAt]
    );

    return id;
}

/**
 * Look up a valid (unused + not expired) password reset token by its hash.
 * When a user clicks the reset link, we hash the token from the URL and
 * look it up here. Only returns tokens that are still valid.
 * @param {object} db - MySQL connection pool
 * @param {string} tokenHash - SHA256 hash of the raw token from the reset URL
 * @returns {Promise<object|null>} The token record if valid, or null if invalid/expired
 */
async function getPasswordResetToken(db, tokenHash) {
    const [rows] = await db.execute(
        `SELECT * FROM password_reset_tokens
         WHERE token_hash = ?
           AND used_at IS NULL
           AND expires_at > NOW()
         LIMIT 1`,
        [tokenHash] // Parameterised to prevent SQL injection
    );

    return rows[0] || null; // Return the token record or null if not found
}

/**
 * Mark a password reset token as used after the password has been changed.
 * Prevents the same reset link from being used multiple times.
 * @param {object} db - MySQL connection pool
 * @param {string} tokenId - UUID of the token record to mark as used
 */
async function markResetTokenUsed(db, tokenId) {
    // Set used_at to current time to invalidate the token
    await db.execute(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?`,
        [tokenId]
    );
}

/**
 * Clean up expired tokens from both verification and reset tables.
 * Called by the hourly cleanup cron job to keep the database tidy and
 * prevent accumulation of stale token records over time.
 * @param {object} db - MySQL connection pool
 */
async function cleanupExpiredTokens(db) {
    // Delete expired email verification tokens (older than 24 hours)
    await db.execute(
        `DELETE FROM email_verification_tokens WHERE expires_at < NOW()`
    );
    // Delete expired password reset tokens (older than 1 hour)
    await db.execute(
        `DELETE FROM password_reset_tokens WHERE expires_at < NOW()`
    );
}

// Export all token management functions for use in auth routes and cleanup jobs
module.exports = {
    createEmailVerificationToken,
    getEmailVerificationToken,
    markEmailTokenUsed,
    createPasswordResetToken,
    getPasswordResetToken,
    markResetTokenUsed,
    cleanupExpiredTokens,
};
