// express-validator's body() function creates validation chains for request body fields
const { body } = require("express-validator");

// Validation rules for placing a new bid
const placeBidValidation = [
    // Bid amount: required, must be a positive number (minimum £0.01)
    body("amount")
        .notEmpty()
        .withMessage("Bid amount is required")
        .isFloat({ min: 0.01 })
        .withMessage("Bid amount must be greater than 0"),
];

// Validation rules for updating an existing bid (increase only, enforced in route)
const updateBidValidation = [
    // Bid amount: required, must be a positive number (minimum £0.01)
    body("amount")
        .notEmpty()
        .withMessage("Bid amount is required")
        .isFloat({ min: 0.01 })
        .withMessage("Bid amount must be greater than 0"),
];

module.exports = {
    placeBidValidation,
    updateBidValidation,
};
