const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");

/**
 * Create a new API token
 * @param {object} db - Database pool
 * @param {object} data - Token data
 * @returns {Promise<{id: string, rawToken: string}>} Token ID and raw token
 */
async function createApiToken(db, { userId, tokenName, expiresAt }) {
    const id = uuidv4();
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

    await db.execute(
        `INSERT INTO api_tokens
            (id, user_id, token_hash, token_name, is_active, expires_at)
         VALUES (?, ?, ?, ?, TRUE, ?)`,
        [id, userId, tokenHash, tokenName, expiresAt || null]
    );

    return { id, rawToken };
}

/**
 * Get active API token by hash
 */
async function getApiTokenByHash(db, tokenHash) {
    const [rows] = await db.execute(
        `SELECT * FROM api_tokens
         WHERE token_hash = ?
           AND is_active = TRUE
           AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1`,
        [tokenHash]
    );
    return rows[0] || null;
}

/**
 * Get all API tokens for a user
 */
async function getApiTokensByUserId(db, userId) {
    const [rows] = await db.execute(
        `SELECT id, user_id, token_name, is_active, expires_at, created_at
         FROM api_tokens
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId]
    );
    return rows;
}

/**
 * Revoke an API token
 */
async function revokeApiToken(db, tokenId) {
    const [result] = await db.execute(
        `UPDATE api_tokens SET is_active = FALSE WHERE id = ?`,
        [tokenId]
    );
    return result.affectedRows === 1;
}

/**
 * Log an API request
 */
async function logApiRequest(db, {
    apiTokenId,
    userId,
    httpMethod,
    endpointAccessed,
    responseStatusCode,
    ipAddress,
    userAgent,
}) {
    const id = uuidv4();
    await db.execute(
        `INSERT INTO api_request_logs
            (id, api_token_id, user_id, http_method,
             endpoint_accessed, response_status_code,
             ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            apiTokenId,
            userId || null,
            httpMethod,
            endpointAccessed,
            responseStatusCode || null,
            ipAddress || null,
            userAgent || null,
        ]
    );
}

/**
 * Get usage stats for an API token
 */
async function getApiTokenStats(db, tokenId) {
    const [rows] = await db.execute(
        `SELECT
            COUNT(*) as total_requests,
            MIN(created_at) as first_used,
            MAX(created_at) as last_used,
            COUNT(DISTINCT endpoint_accessed) as unique_endpoints
         FROM api_request_logs
         WHERE api_token_id = ?`,
        [tokenId]
    );
    return rows[0];
}

/**
 * Get recent request log entries for a token
 */
async function getApiTokenRequestLog(db, tokenId) {
    const [rows] = await db.execute(
        `SELECT * FROM api_request_logs
         WHERE api_token_id = ?
         ORDER BY created_at DESC
         LIMIT 100`,
        [tokenId]
    );
    return rows;
}

/**
 * Deactivate expired API tokens
 */
async function cleanupExpiredApiTokens(db) {
    await db.execute(
        `UPDATE api_tokens SET is_active = FALSE
         WHERE expires_at IS NOT NULL
           AND expires_at < NOW()
           AND is_active = TRUE`
    );
}

/**
 * Get API token by ID (for ownership check)
 */
async function getApiTokenById(db, tokenId) {
    const [rows] = await db.execute(
        `SELECT * FROM api_tokens WHERE id = ? LIMIT 1`,
        [tokenId]
    );
    return rows[0] || null;
}

module.exports = {
    createApiToken,
    getApiTokenByHash,
    getApiTokensByUserId,
    revokeApiToken,
    logApiRequest,
    getApiTokenStats,
    getApiTokenRequestLog,
    cleanupExpiredApiTokens,
    getApiTokenById,
};
