// Node.js built-in crypto module for SHA256 token hashing
const crypto = require("crypto");
// Database pool accessor
const { getDatabase } = require("../lib/database");
// Query functions for API token operations
const apiTokens = require("../queries/apiTokens");

/**
 * Middleware to authenticate API requests using Bearer tokens.
 * Extracts the token from the Authorization header, hashes it with SHA256,
 * and validates it against the database. Logs every API request for auditing.
 * Sets req.apiToken with the token record on success.
 */
async function requireApiAuth(req, res, next) {
    // Extract the Authorization header from the incoming request
    const authHeader = req.headers.authorization;

    // Check that the header exists and uses the Bearer scheme
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Missing or invalid authorization header",
        });
    }

    // Extract the raw token by removing the "Bearer " prefix (7 characters)
    const token = authHeader.substring(7);
    // Hash the token with SHA256 to compare against the stored hash in the database
    // (raw tokens are never stored in the database for security)
    const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    try {
        const db = getDatabase();
        // Look up the hashed token in the database (must be active and not expired)
        const apiToken = await apiTokens.getApiTokenByHash(db, tokenHash);

        // Reject if no matching active token found
        if (!apiToken) {
            return res.status(401).json({
                error: "Invalid or expired API token",
            });
        }

        // Attach the token record to the request for use in downstream route handlers
        req.apiToken = apiToken;

        // Log the API request after the response is fully sent
        // (this captures the actual HTTP status code in the log)
        res.on("finish", () => {
            apiTokens
                .logApiRequest(db, {
                    apiTokenId: apiToken.id, // Which API key was used
                    userId: apiToken.user_id, // Which user owns the key
                    httpMethod: req.method, // GET, POST, etc.
                    endpointAccessed: req.originalUrl, // Full URL path accessed
                    responseStatusCode: res.statusCode, // HTTP response status
                    ipAddress: req.ip, // Client IP address
                    userAgent: req.get("user-agent"), // Client user-agent string
                })
                .catch((err) =>
                    console.error("Failed to log API request:", err)
                );
        });

        next(); // Token is valid, proceed to the route handler
    } catch (error) {
        console.error("API auth error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

module.exports = { requireApiAuth };
