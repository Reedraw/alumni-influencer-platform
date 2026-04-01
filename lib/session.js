// Express session middleware for managing user login state via cookies
const session = require("express-session");

/**
 * Create and configure the Express session middleware.
 * Sessions store authenticated user data on the server, identified by a
 * session ID cookie sent to the browser.
 * @returns {Function} Configured express-session middleware
 */
function createSessionMiddleware() {
    return session({
        secret: process.env.SESSION_SECRET, // Secret key to sign the session ID cookie
        resave: false, // Don't save session if it wasn't modified during the request
        saveUninitialized: false, // Don't create a session until data is stored in it
        cookie: {
            httpOnly: true, // Prevent client-side JavaScript from accessing the cookie (XSS protection)
            secure: false, // Set to true in production (requires HTTPS)
            sameSite: "lax", // Cookie sent with same-site requests and top-level navigations (CSRF protection)
            maxAge: 1000 * 60 * 60 // Session expires after 1 hour (in milliseconds)
        }
    });
}

module.exports = {
    createSessionMiddleware
};