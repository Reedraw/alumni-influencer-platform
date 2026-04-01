// UUID generator for creating unique record IDs
const { v4: uuidv4 } = require("uuid");
// Node.js crypto module for generating secure random tokens and SHA256 hashing
const crypto = require("crypto");

/**
 * Create a new API token for a user.
 * Generates a cryptographically secure random token, hashes it with SHA256,
 * and stores only the hash in the database. The raw token is returned once
 * to the user and never stored — similar to how GitHub personal access tokens work.
 * @param {object} db - MySQL connection pool
 * @param {object} data - Token creation data
 * @param {string} data.userId - UUID of the user creating the token
 * @param {string} data.tokenName - User-friendly name/label for the token
 * @param {Date|null} data.expiresAt - Optional expiration date (null = never expires)
 * @returns {Promise<{id: string, rawToken: string}>} Token ID and the raw token (shown once)
 */
async function createApiToken(db, { userId, tokenName, expiresAt }) {
    const id = uuidv4(); // Unique ID for this token record
    // Generate 32 bytes of cryptographically secure random data as hex string
    const rawToken = crypto.randomBytes(32).toString("hex");
    // Hash the raw token with SHA256 — only the hash is stored in the database
    const tokenHash = crypto
        .createHash("sha256")
        .update(rawToken)
        .digest("hex");

    // Insert the hashed token into the database using parameterised query
    await db.execute(
        `INSERT INTO api_tokens
            (id, user_id, token_hash, token_name, is_active, expires_at)
         VALUES (?, ?, ?, ?, TRUE, ?)`,
        [id, userId, tokenHash, tokenName, expiresAt || null]
    );

    // Return both the ID and raw token — raw token is shown to user only once
    return { id, rawToken };
}

/**
 * Look up an active, non-expired API token by its SHA256 hash.
 * Used by the API authentication middleware to validate incoming Bearer tokens.
 * Only returns tokens that are still active and not past their expiration date.
 * @param {object} db - MySQL connection pool
 * @param {string} tokenHash - SHA256 hash of the raw Bearer token from the request
 * @returns {Promise<object|null>} The token record if valid, or null if invalid/expired
 */
async function getApiTokenByHash(db, tokenHash) {
    const [rows] = await db.execute(
        `SELECT * FROM api_tokens
         WHERE token_hash = ?
           AND is_active = TRUE
           AND (expires_at IS NULL OR expires_at > NOW())
         LIMIT 1`,
        [tokenHash] // Parameterised to prevent SQL injection
    );
    return rows[0] || null; // Return the token record or null if not found
}

/**
 * Get all API tokens belonging to a specific user.
 * Used on the API key management page to list the user's tokens.
 * Excludes the token_hash column for security — users see name and status only.
 * @param {object} db - MySQL connection pool
 * @param {string} userId - UUID of the user whose tokens to retrieve
 * @returns {Promise<Array>} Array of token records (without hashes), newest first
 */
async function getApiTokensByUserId(db, userId) {
    const [rows] = await db.execute(
        // Select specific columns — deliberately excludes token_hash for security
        `SELECT id, user_id, token_name, is_active, expires_at, created_at
         FROM api_tokens
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId]
    );
    return rows;
}

/**
 * Revoke (deactivate) an API token by setting is_active to FALSE.
 * Once revoked, the token can no longer be used for API authentication.
 * This is a soft delete — the record remains for audit purposes.
 * @param {object} db - MySQL connection pool
 * @param {string} tokenId - UUID of the token to revoke
 * @returns {Promise<boolean>} True if the token was found and revoked
 */
async function revokeApiToken(db, tokenId) {
    const [result] = await db.execute(
        `UPDATE api_tokens SET is_active = FALSE WHERE id = ?`,
        [tokenId]
    );
    return result.affectedRows === 1; // True if exactly one row was updated
}

/**
 * Log an API request made using a specific token.
 * Records the HTTP method, endpoint, response status, IP, and user-agent
 * for security monitoring and usage analytics on the API key stats page.
 * @param {object} db - MySQL connection pool
 * @param {object} data - Request log data
 * @param {string} data.apiTokenId - UUID of the API token used
 * @param {string|null} data.userId - UUID of the token owner
 * @param {string} data.httpMethod - HTTP method (GET, POST, etc.)
 * @param {string} data.endpointAccessed - The API endpoint path
 * @param {number|null} data.responseStatusCode - HTTP response status code
 * @param {string|null} data.ipAddress - Client IP address
 * @param {string|null} data.userAgent - Client browser/tool user-agent string
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
    const id = uuidv4(); // Unique ID for this log entry
    // Insert the request log using parameterised query
    await db.execute(
        `INSERT INTO api_request_logs
            (id, api_token_id, user_id, http_method,
             endpoint_accessed, response_status_code,
             ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id,
            apiTokenId,
            userId || null, // May be null if token lookup failed
            httpMethod,
            endpointAccessed,
            responseStatusCode || null, // Null until response is sent
            ipAddress || null, // Client IP for security tracking
            userAgent || null, // Browser/tool info for analytics
        ]
    );
}

/**
 * Get aggregated usage statistics for a specific API token.
 * Returns total request count, first/last usage timestamps, and
 * number of unique endpoints accessed — displayed on the stats page.
 * @param {object} db - MySQL connection pool
 * @param {string} tokenId - UUID of the API token to get stats for
 * @returns {Promise<object>} Stats object with total_requests, first_used, last_used, unique_endpoints
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
    return rows[0]; // Always returns one row due to COUNT aggregate
}

/**
 * Get the most recent 100 request log entries for a specific API token.
 * Used on the API key stats page to show a detailed request history.
 * Limited to 100 entries to prevent excessive data loading.
 * @param {object} db - MySQL connection pool
 * @param {string} tokenId - UUID of the API token to get logs for
 * @returns {Promise<Array>} Array of request log records, newest first
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
 * Deactivate all API tokens that have passed their expiration date.
 * Called by the hourly cleanup cron job to automatically revoke
 * expired tokens so they can no longer be used for authentication.
 * @param {object} db - MySQL connection pool
 */
async function cleanupExpiredApiTokens(db) {
    // Only update tokens that are both expired AND still active
    await db.execute(
        `UPDATE api_tokens SET is_active = FALSE
         WHERE expires_at IS NOT NULL
           AND expires_at < NOW()
           AND is_active = TRUE`
    );
}

/**
 * Get a single API token record by its ID (regardless of active status).
 * Used for ownership verification before allowing revoke/stats operations,
 * ensuring users can only manage their own tokens.
 * @param {object} db - MySQL connection pool
 * @param {string} tokenId - UUID of the token to look up
 * @returns {Promise<object|null>} The token record or null if not found
 */
async function getApiTokenById(db, tokenId) {
    const [rows] = await db.execute(
        `SELECT * FROM api_tokens WHERE id = ? LIMIT 1`,
        [tokenId]
    );
    return rows[0] || null; // Return the token record or null if not found
}

// Export all API token management functions
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
