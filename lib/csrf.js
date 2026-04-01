// Node.js built-in crypto module for timing-safe comparison
const crypto = require("crypto");

/**
 * CSRF protection middleware for POST/PUT/DELETE requests.
 * Validates the _csrf hidden form field against the session-stored token.
 * Prevents Cross-Site Request Forgery attacks by ensuring form submissions
 * originate from our own pages, not from malicious third-party sites.
 */
function csrfProtection(req, res, next) {
    // Skip CSRF validation for safe HTTP methods (read-only requests)
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        return next();
    }

    // Extract the CSRF token submitted in the form's hidden field
    const token = req.body._csrf;
    // Get the CSRF token stored in the user's session (set in app.js middleware)
    const sessionToken = req.session.csrfToken;

    // Reject the request if either token is missing
    if (!token || !sessionToken) {
        return res.status(403).send("CSRF token missing");
    }

    try {
        // Use timing-safe comparison to prevent timing attacks
        // (Buffer lengths must match, or timingSafeEqual throws)
        const valid = crypto.timingSafeEqual(
            Buffer.from(token),
            Buffer.from(sessionToken)
        );
        // Reject if tokens don't match
        if (!valid) {
            return res.status(403).send("Invalid CSRF token");
        }
    } catch {
        // Catch buffer length mismatch errors from timingSafeEqual
        return res.status(403).send("Invalid CSRF token");
    }

    // Token is valid, proceed to the next middleware/route handler
    next();
}

module.exports = { csrfProtection };
