/**
 * Require authenticated session - redirects to login if not authenticated
 */
function requireAuth(req, res, next) {
    if (!req.session || !req.session.user) {
        return res.redirect("/login");
    }
    next();
}

module.exports = {
    requireAuth,
};