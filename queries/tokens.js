const { v4: uuidv4 } = require("uuid");

/**
 * Create email verification token
 * @param {object} db - Database pool
 * @param {string} userId - User ID
 * @param {string} tokenHash - SHA256 hash of the raw token
 * @returns {Promise<string>} Token record ID
 */
async function createEmailVerificationToken(db, userId, tokenHash) {
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.execute(
        `INSERT INTO email_verification_tokens
            (id, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`,
        [id, userId, tokenHash, expiresAt]
    );

    return id;
}

/**
 * Get valid email verification token by hash
 * @param {object} db - Database pool
 * @param {string} tokenHash - SHA256 hash of the raw token
 * @returns {Promise<object|null>} Token record or null
 */
async function getEmailVerificationToken(db, tokenHash) {
    const [rows] = await db.execute(
        `SELECT * FROM email_verification_tokens
         WHERE token_hash = ?
           AND used_at IS NULL
           AND expires_at > NOW()
         LIMIT 1`,
        [tokenHash]
    );

    return rows[0] || null;
}

/**
 * Mark email verification token as used
 * @param {object} db - Database pool
 * @param {string} tokenId - Token record ID
 */
async function markEmailTokenUsed(db, tokenId) {
    await db.execute(
        `UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ?`,
        [tokenId]
    );
}

/**
 * Create password reset token (invalidates existing tokens for user)
 * @param {object} db - Database pool
 * @param {string} userId - User ID
 * @param {string} tokenHash - SHA256 hash of the raw token
 * @returns {Promise<string>} Token record ID
 */
async function createPasswordResetToken(db, userId, tokenHash) {
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate existing tokens for this user
    await db.execute(
        `UPDATE password_reset_tokens SET used_at = NOW()
         WHERE user_id = ? AND used_at IS NULL`,
        [userId]
    );

    await db.execute(
        `INSERT INTO password_reset_tokens
            (id, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`,
        [id, userId, tokenHash, expiresAt]
    );

    return id;
}

/**
 * Get valid password reset token by hash
 * @param {object} db - Database pool
 * @param {string} tokenHash - SHA256 hash of the raw token
 * @returns {Promise<object|null>} Token record or null
 */
async function getPasswordResetToken(db, tokenHash) {
    const [rows] = await db.execute(
        `SELECT * FROM password_reset_tokens
         WHERE token_hash = ?
           AND used_at IS NULL
           AND expires_at > NOW()
         LIMIT 1`,
        [tokenHash]
    );

    return rows[0] || null;
}

/**
 * Mark password reset token as used
 * @param {object} db - Database pool
 * @param {string} tokenId - Token record ID
 */
async function markResetTokenUsed(db, tokenId) {
    await db.execute(
        `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?`,
        [tokenId]
    );
}

/**
 * Clean up expired tokens from both tables
 * @param {object} db - Database pool
 */
async function cleanupExpiredTokens(db) {
    await db.execute(
        `DELETE FROM email_verification_tokens WHERE expires_at < NOW()`
    );
    await db.execute(
        `DELETE FROM password_reset_tokens WHERE expires_at < NOW()`
    );
}

module.exports = {
    createEmailVerificationToken,
    getEmailVerificationToken,
    markEmailTokenUsed,
    createPasswordResetToken,
    getPasswordResetToken,
    markResetTokenUsed,
    cleanupExpiredTokens,
};
