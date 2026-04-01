/**
 * Session authentication middleware.
 * Protects routes that require a logged-in user by checking for an active session.
 * If no session exists, the user is redirected to the login page.
 */
function requireAuth(req, res, next) {
    // Check if the session exists and contains a user object (set during login)
    if (!req.session || !req.session.user) {
        return res.redirect("/login"); // Redirect unauthenticated users to login
    }
    next(); // User is authenticated, proceed to the route handler
}

module.exports = {
    requireAuth,
};