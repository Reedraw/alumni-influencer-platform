// Express framework for creating modular route handlers
const express = require("express");
// Create a new router instance for auth-related routes
const router = express.Router();
// UUID generator for creating unique user IDs on registration
const { v4: uuidv4 } = require("uuid");
// express-validator result extractor for checking form validation errors
const { validationResult } = require("express-validator");

// Database connection pool accessor
const { getDatabase } = require("../lib/database");
// bcrypt password verification utility
const { verifyPassword } = require("../lib/password");
// Email utilities: token generation, SHA256 hashing, and email sending
const {
    generateToken,
    hashToken,
    sendVerificationEmail,
    sendPasswordResetEmail,
} = require("../lib/email");
// CSRF protection middleware to prevent cross-site request forgery
const { csrfProtection } = require("../lib/csrf");
// In-memory rate limiter to prevent brute-force attacks
const { rateLimit } = require("../lib/rate-limit");

// Database query functions for user CRUD operations
const users = require("../queries/users");
// Database query functions for verification/reset token management
const tokens = require("../queries/tokens");
// Database query functions for security audit logging
const audit = require("../queries/audit");

// Validation schemas for auth forms (register, login, forgot/reset password)
const {
    registerValidation,
    loginValidation,
    forgotPasswordValidation,
    resetPasswordValidation,
} = require("../models/authSchema");

// Rate limiting: max 20 requests per 15 minutes per IP for all auth endpoints
// Prevents brute-force login attempts and registration spam
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// ==================== REGISTER ====================

// GET /register — Display the registration form
router.get("/register", (req, res) => {
    res.render("auth/register", { errors: [] });
});

// POST /register — Handle registration form submission
router.post(
    "/register",
    authLimiter, // Rate limit to prevent spam registrations
    csrfProtection, // Validate CSRF token from the form
    registerValidation, // Validate name, email domain, password strength
    async (req, res) => {
        try {
            // Check for validation errors from express-validator
            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                // Re-render the form with validation error messages
                return res.status(400).render("auth/register", {
                    errors: valErrors.array().map((e) => e.msg),
                });
            }

            // Get the shared database connection for checking and creating users.
            const db = getDatabase();
            // Read the submitted registration fields from the form payload.
            const { full_name, email, password } = req.body;

            // Check if email is already registered to prevent duplicates
            const existingUser = await users.getUserByEmail(db, email);
            if (existingUser) {
                return res.status(400).render("auth/register", {
                    errors: ["Email already registered"],
                });
            }

            // Create the new user account with a UUID primary key
            const userId = uuidv4();
            await users.createUser(db, {
                id: userId,
                full_name,
                email,
                password, // Will be hashed with bcrypt (12 rounds) inside createUser
                is_verified: false, // Must verify email before logging in
                is_active: true,
            });

            // Generate a secure random token and hash it for database storage
            const rawToken = generateToken(); // 32 random bytes as hex
            const tokenHash = hashToken(rawToken); // SHA256 hash for storage
            // Store the hashed token in the database (expires in 24 hours)
            await tokens.createEmailVerificationToken(
                db, userId, tokenHash
            );

            // Send the raw (unhashed) token to the user's email as a verification link
            sendVerificationEmail(email, rawToken);

            // Log the registration action in the security audit trail
            await audit.logAuthAction(db, {
                userId,
                emailAttempted: email,
                action: "register",
                ipAddress: req.ip,
                userAgent: req.get("user-agent"),
            });

            // Show the "check your email" verification page
            res.render("auth/verify-email", { email });
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== EMAIL VERIFICATION ====================

// GET /verify-email?token=... — Verify a user's email address via the link they received
router.get("/verify-email", async (req, res) => {
    try {
        // Extract the raw token from the query string
        const { token } = req.query;
        if (!token) {
            return res.status(400).send(
                "Invalid verification link"
            );
        }

        const db = getDatabase();
        // Hash the raw token from the URL to look it up in the database
        const tokenHash = hashToken(token);
        // Find a valid (unused + not expired) verification token matching this hash
        const verificationToken =
            await tokens.getEmailVerificationToken(db, tokenHash);

        if (!verificationToken) {
            return res.status(400).send(
                "Invalid or expired verification link"
            );
        }

        // Mark the user's email as verified in the users table
        await users.verifyUserEmail(db, verificationToken.user_id);
        // Mark the token as used so it can't be reused
        await tokens.markEmailTokenUsed(db, verificationToken.id);

        // Log the verification in the security audit trail
        await audit.logAuthAction(db, {
            userId: verificationToken.user_id,
            action: "email_verified",
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
        });

        // If the user is currently logged in, update their session flag
        if (req.session && req.session.user &&
            req.session.user.id === verificationToken.user_id) {
            req.session.user.is_verified = true;
        }

        // Redirect to login with a success message
        res.redirect(
            "/login?message=Email verified successfully. Please login."
        );
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// ==================== LOGIN ====================

// GET /login — Display the login form (with optional success message from verification/reset)
router.get("/login", (req, res) => {
    res.render("auth/login", {
        errors: [],
        message: req.query.message || null, // Success message from redirects
    });
});

// POST /login — Handle login form submission and create user session
router.post(
    "/login",
    authLimiter, // Rate limit to prevent brute-force password attacks
    csrfProtection, // Validate CSRF token from the form
    loginValidation, // Validate email format and password presence
    async (req, res) => {
        try {
            // Check for validation errors from express-validator
            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                return res.status(400).render("auth/login", {
                    errors: valErrors.array().map((e) => e.msg),
                    message: null,
                });
            }

            const db = getDatabase();
            const { email, password } = req.body;

            // Look up the user by email address
            const user = await users.getUserByEmail(db, email);

            // If no user found, log the failed attempt and show generic error
            // Generic error prevents email enumeration attacks
            if (!user) {
                await audit.logAuthAction(db, {
                    emailAttempted: email,
                    action: "login_failed",
                    ipAddress: req.ip,
                    userAgent: req.get("user-agent"),
                });
                return res.status(401).render("auth/login", {
                    errors: ["Invalid email or password"],
                    message: null,
                });
            }

            // Check if the account has been deactivated
            if (!user.is_active) {
                return res.status(403).render("auth/login", {
                    errors: ["Account is disabled"],
                    message: null,
                });
            }

            // Verify the submitted password against the stored bcrypt hash
            const validPassword = await verifyPassword(
                password,
                user.password_hash
            );

            // If password doesn't match, log the failed attempt with the user ID
            if (!validPassword) {
                await audit.logAuthAction(db, {
                    userId: user.id,
                    emailAttempted: email,
                    action: "login_failed",
                    ipAddress: req.ip,
                    userAgent: req.get("user-agent"),
                });
                return res.status(401).render("auth/login", {
                    errors: ["Invalid email or password"],
                    message: null,
                });
            }

            // Authentication successful — create a session with user data
            // Only store essential user info in the session (not the password hash)
            // Include is_verified so the profile page can show a verification banner
            req.session.user = {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
                is_verified: user.is_verified,
            };

            // Log the successful login in the audit trail
            await audit.logAuthAction(db, {
                userId: user.id,
                emailAttempted: email,
                action: "login_success",
                ipAddress: req.ip,
                userAgent: req.get("user-agent"),
            });

            // Redirect to the user's profile page
            res.redirect("/profile");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== FORGOT PASSWORD ====================

// GET /forgot-password — Display the forgot password form
router.get("/forgot-password", (req, res) => {
    res.render("auth/forgot-password", {
        errors: [],
        message: null,
    });
});

// POST /forgot-password — Handle forgot password request and send reset email
router.post(
    "/forgot-password",
    authLimiter, // Rate limit to prevent abuse
    csrfProtection, // Validate CSRF token from the form
    forgotPasswordValidation, // Validate email format
    async (req, res) => {
        try {
            const db = getDatabase();
            const { email } = req.body;

            // Look up the user by email
            const user = await users.getUserByEmail(db, email);

            // SECURITY: Always show the same success message regardless of whether
            // an account exists — this prevents email enumeration attacks
            if (user) {
                // Generate and store a password reset token (1 hour expiry)
                const rawToken = generateToken();
                const tokenHash = hashToken(rawToken);
                // This also invalidates any existing unused reset tokens for this user
                await tokens.createPasswordResetToken(
                    db, user.id, tokenHash
                );
                // Send the raw token to the user's email as a reset link
                sendPasswordResetEmail(email, rawToken);

                // Log the reset request in the audit trail
                await audit.logAuthAction(db, {
                    userId: user.id,
                    emailAttempted: email,
                    action: "password_reset_requested",
                    ipAddress: req.ip,
                    userAgent: req.get("user-agent"),
                });
            }

            // Same response whether or not the user exists (prevents enumeration)
            res.render("auth/forgot-password", {
                errors: [],
                message:
                    "If an account exists with that email, " +
                    "a reset link has been sent.",
            });
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== RESET PASSWORD ====================

// GET /reset-password?token=... — Display the reset password form
router.get("/reset-password", async (req, res) => {
    try {
        // Extract the raw token from the query string
        const { token } = req.query;
        if (!token) {
            return res.status(400).send("Invalid reset link");
        }

        const db = getDatabase();
        // Hash the token and verify it exists and hasn't expired
        const tokenHash = hashToken(token);
        const resetToken =
            await tokens.getPasswordResetToken(db, tokenHash);

        if (!resetToken) {
            return res.status(400).send(
                "Invalid or expired reset link"
            );
        }

        // Token is valid — show the password reset form with the token embedded
        res.render("auth/reset-password", {
            token, // Pass the raw token so it can be included in the POST form
            errors: [],
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// POST /reset-password — Handle the new password submission
router.post(
    "/reset-password",
    authLimiter, // Rate limit to prevent brute-force attacks
    csrfProtection, // Validate CSRF token from the form
    resetPasswordValidation, // Validate password strength and confirmation match
    async (req, res) => {
        try {
            const { token, password } = req.body;
            if (!token) {
                return res.status(400).send("Invalid reset link");
            }

            // Check for validation errors (password strength, confirmation match)
            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                return res.status(400).render("auth/reset-password", {
                    token,
                    errors: valErrors.array().map((e) => e.msg),
                });
            }

            const db = getDatabase();
            // Re-verify the token is still valid (hasn't expired or been used)
            const tokenHash = hashToken(token);
            const resetToken =
                await tokens.getPasswordResetToken(db, tokenHash);

            if (!resetToken) {
                return res.status(400).send(
                    "Invalid or expired reset link"
                );
            }

            // Update the user's password (will be hashed with bcrypt)
            await users.updateUserPassword(
                db, resetToken.user_id, password
            );
            // Mark the reset token as used to prevent reuse
            await tokens.markResetTokenUsed(db, resetToken.id);

            // Log the completed password reset in the audit trail
            await audit.logAuthAction(db, {
                userId: resetToken.user_id,
                action: "password_reset_completed",
                ipAddress: req.ip,
                userAgent: req.get("user-agent"),
            });

            // Redirect to login with success message
            res.redirect(
                "/login?message=Password reset successful. Please login."
            );
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== LOGOUT ====================

// POST /logout — Destroy the user's session and redirect to login
router.post("/logout", (req, res) => {
    // Destroy the server-side session data
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Logout failed");
        }
        // Clear the session cookie from the browser
        res.clearCookie("connect.sid");
        // Redirect to the login page
        res.redirect("/login");
    });
});

// Export the router for mounting in app.js
module.exports = router;