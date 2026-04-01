const crypto = require("crypto");

/**
 * CSRF protection middleware for POST/PUT/DELETE requests.
 * Validates _csrf field from request body against session token.
 */
function csrfProtection(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        return next();
    }

    const token = req.body._csrf;
    const sessionToken = req.session.csrfToken;

    if (!token || !sessionToken) {
        return res.status(403).send("CSRF token missing");
    }

    try {
        const valid = crypto.timingSafeEqual(
            Buffer.from(token),
            Buffer.from(sessionToken)
        );
        if (!valid) {
            return res.status(403).send("Invalid CSRF token");
        }
    } catch {
        return res.status(403).send("Invalid CSRF token");
    }

    next();
}

module.exports = { csrfProtection };
