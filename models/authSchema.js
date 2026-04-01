// express-validator's body() function creates validation chains for request body fields
const { body } = require("express-validator");

// Validation rules for the registration form
const registerValidation = [
    // Full name: must not be empty, trim whitespace, escape HTML to prevent XSS
    body("full_name")
        .trim()
        .notEmpty()
        .withMessage("Full name is required")
        .escape(),

    // Email: must be valid format, normalise to lowercase, must use university domain
    body("email")
        .trim()
        .isEmail()
        .withMessage("A valid email is required")
        .normalizeEmail()
        .custom((value) => {
            // Restrict registration to the allowed university email domain
            const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
            if (!value.toLowerCase().endsWith(`@${allowedDomain}`)) {
                throw new Error(
                    `Email must use the ${allowedDomain} domain`
                );
            }
            return true;
        }),

    // Password: enforce strong password policy with multiple complexity requirements
    body("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters long")
        .matches(/[A-Z]/)
        .withMessage("Password must contain at least one uppercase letter")
        .matches(/[a-z]/)
        .withMessage("Password must contain at least one lowercase letter")
        .matches(/[0-9]/)
        .withMessage("Password must contain at least one number")
        .matches(/[!@#$%^&*(),.?":{}|<>]/)
        .withMessage(
            "Password must contain at least one special character"
        ),

    // Confirm password: must match the password field exactly
    body("confirm_password").custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error("Passwords do not match");
        }
        return true;
    }),
];

// Validation rules for the login form
const loginValidation = [
    // Email: must be a valid email format, normalise to consistent format
    body("email")
        .trim()
        .isEmail()
        .withMessage("A valid email is required")
        .normalizeEmail(),

    // Password: only check that it's not empty (actual verification done in route)
    body("password").notEmpty().withMessage("Password is required"),
];

// Validation rules for the forgot password form
const forgotPasswordValidation = [
    // Email: must be a valid email format
    body("email")
        .trim()
        .isEmail()
        .withMessage("A valid email is required")
        .normalizeEmail(),
];

// Validation rules for the password reset form (same complexity as registration)
const resetPasswordValidation = [
    // New password: enforce the same strong password policy as registration
    body("password")
        .isLength({ min: 8 })
        .withMessage("Password must be at least 8 characters long")
        .matches(/[A-Z]/)
        .withMessage("Password must contain at least one uppercase letter")
        .matches(/[a-z]/)
        .withMessage("Password must contain at least one lowercase letter")
        .matches(/[0-9]/)
        .withMessage("Password must contain at least one number")
        .matches(/[!@#$%^&*(),.?":{}|<>]/)
        .withMessage(
            "Password must contain at least one special character"
        ),

    // Confirm password: must match the new password field
    body("confirm_password").custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error("Passwords do not match");
        }
        return true;
    }),
];

module.exports = {
    registerValidation,
    loginValidation,
    forgotPasswordValidation,
    resetPasswordValidation,
};