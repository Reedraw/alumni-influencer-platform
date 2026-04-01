const { validationResult } = require("express-validator");

/**
 * Extract validation errors as an array of message strings
 * @param {object} req - Express request
 * @returns {string[]|null} Array of error messages, or null if no errors
 */
function getValidationErrors(req) {
    const result = validationResult(req);
    if (result.isEmpty()) return null;
    return result.array().map((err) => err.msg);
}

module.exports = { getValidationErrors };
