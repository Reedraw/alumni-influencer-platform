const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { validationResult } = require("express-validator");

const { getDatabase } = require("../lib/database");
const { verifyPassword } = require("../lib/password");
const {
    generateToken,
    hashToken,
    sendVerificationEmail,
    sendPasswordResetEmail,
} = require("../lib/email");
const { csrfProtection } = require("../lib/csrf");
const { rateLimit } = require("../lib/rate-limit");

const users = require("../queries/users");
const tokens = require("../queries/tokens");
const audit = require("../queries/audit");

const {
    registerValidation,
    loginValidation,
    forgotPasswordValidation,
    resetPasswordValidation,
} = require("../models/authSchema");

// Rate limiting for auth endpoints
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// ==================== REGISTER ====================

router.get("/register", (req, res) => {
    res.render("auth/register", { errors: [] });
});

router.post(
    "/register",
    authLimiter,
    csrfProtection,
    registerValidation,
    async (req, res) => {
        try {
            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                return res.status(400).render("auth/register", {
                    errors: valErrors.array().map((e) => e.msg),
                });
            }

            const db = getDatabase();
            const { full_name, email, password } = req.body;

            // Check duplicate email
            const existingUser = await users.getUserByEmail(db, email);
            if (existingUser) {
                return res.status(400).render("auth/register", {
                    errors: ["Email already registered"],
                });
            }

            // Create user
            const userId = uuidv4();
            await users.createUser(db, {
                id: userId,
                full_name,
                email,
                password,
                is_verified: false,
                is_active: true,
            });

            // Generate and store verification token
            const rawToken = generateToken();
            const tokenHash = hashToken(rawToken);
            await tokens.createEmailVerificationToken(
                db, userId, tokenHash
            );

            // Send verification email
            sendVerificationEmail(email, rawToken);

            // Audit log
            await audit.logAuthAction(db, {
                userId,
                emailAttempted: email,
                action: "register",
                ipAddress: req.ip,
                userAgent: req.get("user-agent"),
            });

            res.render("auth/verify-email", { email });
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== EMAIL VERIFICATION ====================

router.get("/verify-email", async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).send(
                "Invalid verification link"
            );
        }

        const db = getDatabase();
        const tokenHash = hashToken(token);
        const verificationToken =
            await tokens.getEmailVerificationToken(db, tokenHash);

        if (!verificationToken) {
            return res.status(400).send(
                "Invalid or expired verification link"
            );
        }

        // Mark user as verified
        await users.verifyUserEmail(db, verificationToken.user_id);
        await tokens.markEmailTokenUsed(db, verificationToken.id);

        // Audit log
        await audit.logAuthAction(db, {
            userId: verificationToken.user_id,
            action: "email_verified",
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
        });

        res.redirect(
            "/login?message=Email verified successfully. Please login."
        );
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// ==================== LOGIN ====================

router.get("/login", (req, res) => {
    res.render("auth/login", {
        errors: [],
        message: req.query.message || null,
    });
});

router.post(
    "/login",
    authLimiter,
    csrfProtection,
    loginValidation,
    async (req, res) => {
        try {
            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                return res.status(400).render("auth/login", {
                    errors: valErrors.array().map((e) => e.msg),
                    message: null,
                });
            }

            const db = getDatabase();
            const { email, password } = req.body;

            // Get user
            const user = await users.getUserByEmail(db, email);

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

            if (!user.is_active) {
                return res.status(403).render("auth/login", {
                    errors: ["Account is disabled"],
                    message: null,
                });
            }

            if (!user.is_verified) {
                return res.status(403).render("auth/login", {
                    errors: ["Please verify your email first"],
                    message: null,
                });
            }

            // Verify password
            const validPassword = await verifyPassword(
                password,
                user.password_hash
            );

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

            // Create session
            req.session.user = {
                id: user.id,
                full_name: user.full_name,
                email: user.email,
            };

            await audit.logAuthAction(db, {
                userId: user.id,
                emailAttempted: email,
                action: "login_success",
                ipAddress: req.ip,
                userAgent: req.get("user-agent"),
            });

            res.redirect("/profile");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== FORGOT PASSWORD ====================

router.get("/forgot-password", (req, res) => {
    res.render("auth/forgot-password", {
        errors: [],
        message: null,
    });
});

router.post(
    "/forgot-password",
    authLimiter,
    csrfProtection,
    forgotPasswordValidation,
    async (req, res) => {
        try {
            const db = getDatabase();
            const { email } = req.body;

            const user = await users.getUserByEmail(db, email);

            // Always show success to prevent email enumeration
            if (user) {
                const rawToken = generateToken();
                const tokenHash = hashToken(rawToken);
                await tokens.createPasswordResetToken(
                    db, user.id, tokenHash
                );
                sendPasswordResetEmail(email, rawToken);

                await audit.logAuthAction(db, {
                    userId: user.id,
                    emailAttempted: email,
                    action: "password_reset_requested",
                    ipAddress: req.ip,
                    userAgent: req.get("user-agent"),
                });
            }

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

router.get("/reset-password", async (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).send("Invalid reset link");
        }

        const db = getDatabase();
        const tokenHash = hashToken(token);
        const resetToken =
            await tokens.getPasswordResetToken(db, tokenHash);

        if (!resetToken) {
            return res.status(400).send(
                "Invalid or expired reset link"
            );
        }

        res.render("auth/reset-password", {
            token,
            errors: [],
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

router.post(
    "/reset-password",
    authLimiter,
    csrfProtection,
    resetPasswordValidation,
    async (req, res) => {
        try {
            const { token, password } = req.body;
            if (!token) {
                return res.status(400).send("Invalid reset link");
            }

            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                return res.status(400).render("auth/reset-password", {
                    token,
                    errors: valErrors.array().map((e) => e.msg),
                });
            }

            const db = getDatabase();
            const tokenHash = hashToken(token);
            const resetToken =
                await tokens.getPasswordResetToken(db, tokenHash);

            if (!resetToken) {
                return res.status(400).send(
                    "Invalid or expired reset link"
                );
            }

            await users.updateUserPassword(
                db, resetToken.user_id, password
            );
            await tokens.markResetTokenUsed(db, resetToken.id);

            await audit.logAuthAction(db, {
                userId: resetToken.user_id,
                action: "password_reset_completed",
                ipAddress: req.ip,
                userAgent: req.get("user-agent"),
            });

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

router.post("/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error(err);
            return res.status(500).send("Logout failed");
        }
        res.clearCookie("connect.sid");
        res.redirect("/login");
    });
});

module.exports = router;