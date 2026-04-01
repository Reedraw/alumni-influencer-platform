// express-validator provides the validationResult function to check for validation errors
const { validationResult } = require("express-validator");

/**
 * Extract validation errors from the request as a simple array of message strings.
 * Used by route handlers to check if express-validator found any invalid input.
 * @param {object} req - Express request object (after validation middleware has run)
 * @returns {string[]|null} Array of error message strings, or null if no errors
 */
function getValidationErrors(req) {
    // Collect all validation errors from the request
    const result = validationResult(req);
    // Return null if validation passed (no errors found)
    if (result.isEmpty()) return null;
    // Map the error objects to just their message strings for display in EJS templates
    return result.array().map((err) => err.msg);
}

module.exports = { getValidationErrors };
