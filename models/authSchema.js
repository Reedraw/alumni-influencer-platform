const { body } = require("express-validator");

const registerValidation = [
    body("full_name")
        .trim()
        .notEmpty()
        .withMessage("Full name is required")
        .escape(),

    body("email")
        .trim()
        .isEmail()
        .withMessage("A valid email is required")
        .normalizeEmail()
        .custom((value) => {
            const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN;
            if (!value.toLowerCase().endsWith(`@${allowedDomain}`)) {
                throw new Error(
                    `Email must use the ${allowedDomain} domain`
                );
            }
            return true;
        }),

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

    body("confirm_password").custom((value, { req }) => {
        if (value !== req.body.password) {
            throw new Error("Passwords do not match");
        }
        return true;
    }),
];

const loginValidation = [
    body("email")
        .trim()
        .isEmail()
        .withMessage("A valid email is required")
        .normalizeEmail(),

    body("password").notEmpty().withMessage("Password is required"),
];

const forgotPasswordValidation = [
    body("email")
        .trim()
        .isEmail()
        .withMessage("A valid email is required")
        .normalizeEmail(),
];

const resetPasswordValidation = [
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