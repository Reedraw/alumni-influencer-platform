const { body } = require("express-validator");

const placeBidValidation = [
    body("amount")
        .notEmpty()
        .withMessage("Bid amount is required")
        .isFloat({ min: 0.01 })
        .withMessage("Bid amount must be greater than 0"),
];

const updateBidValidation = [
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
