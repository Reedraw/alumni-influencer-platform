const crypto = require("crypto");
const { getDatabase } = require("../lib/database");
const apiTokens = require("../queries/apiTokens");

/**
 * Middleware to authenticate API requests using Bearer tokens.
 * Validates the token against the database, logs the request.
 * Sets req.apiToken with the token record on success.
 */
async function requireApiAuth(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            error: "Missing or invalid authorization header",
        });
    }

    const token = authHeader.substring(7);
    const tokenHash = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

    try {
        const db = getDatabase();
        const apiToken = await apiTokens.getApiTokenByHash(db, tokenHash);

        if (!apiToken) {
            return res.status(401).json({
                error: "Invalid or expired API token",
            });
        }

        req.apiToken = apiToken;

        // Log request after response is sent (captures status code)
        res.on("finish", () => {
            apiTokens
                .logApiRequest(db, {
                    apiTokenId: apiToken.id,
                    userId: apiToken.user_id,
                    httpMethod: req.method,
                    endpointAccessed: req.originalUrl,
                    responseStatusCode: res.statusCode,
                    ipAddress: req.ip,
                    userAgent: req.get("user-agent"),
                })
                .catch((err) =>
                    console.error("Failed to log API request:", err)
                );
        });

        next();
    } catch (error) {
        console.error("API auth error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

module.exports = { requireApiAuth };
