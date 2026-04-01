const session = require("express-session");

function createSessionMiddleware() {
    return session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
            httpOnly: true,
            secure: false,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60
        }
    });
}

module.exports = {
    createSessionMiddleware
};