// express-validator's body() function creates validation chains for request body fields
const { body } = require("express-validator");

// Validation rules for the main profile fields (biography and LinkedIn URL)
const profileValidation = [
    // Biography: optional free-text field, limited to 5000 characters
    body("biography")
        .optional()
        .trim()
        .isLength({ max: 5000 })
        .withMessage("Biography must be under 5000 characters"),
    // LinkedIn URL: optional, must be a valid URL format if provided
    body("linkedin_url")
        .optional({ values: "falsy" }) // Treat empty strings as "not provided"
        .trim()
        .isURL()
        .withMessage("Must be a valid URL"),
];

// Validation rules for adding/editing a degree entry
const degreeValidation = [
    // Degree name is the only required field
    body("degree_name")
        .trim()
        .notEmpty()
        .withMessage("Degree name is required"),
    // Institution name is optional, just trim whitespace
    body("institution_name").optional().trim(),
    // URL to the official university degree page (optional, must be valid URL if provided)
    body("degree_url")
        .optional({ values: "falsy" })
        .trim()
        .isURL()
        .withMessage("Must be a valid URL"),
    // Completion date (optional, must be a valid date format if provided)
    body("completion_date")
        .optional({ values: "falsy" })
        .isDate()
        .withMessage("Must be a valid date"),
];

// Validation rules for adding/editing a professional certification entry
const certificationValidation = [
    // Certification name is required
    body("certification_name")
        .trim()
        .notEmpty()
        .withMessage("Certification name is required"),
    // Provider name is optional
    body("provider_name").optional().trim(),
    // URL to the certification course page (optional)
    body("course_url")
        .optional({ values: "falsy" })
        .trim()
        .isURL()
        .withMessage("Must be a valid URL"),
    // Completion date (optional)
    body("completion_date")
        .optional({ values: "falsy" })
        .isDate()
        .withMessage("Must be a valid date"),
];

// Validation rules for adding/editing a professional licence entry
const licenceValidation = [
    // Licence name is required
    body("licence_name")
        .trim()
        .notEmpty()
        .withMessage("Licence name is required"),
    // Awarding body name is optional
    body("awarding_body_name").optional().trim(),
    // URL to the licence awarding body (optional)
    body("awarding_body_url")
        .optional({ values: "falsy" })
        .trim()
        .isURL()
        .withMessage("Must be a valid URL"),
    // Completion date (optional)
    body("completion_date")
        .optional({ values: "falsy" })
        .isDate()
        .withMessage("Must be a valid date"),
];

// Validation rules for adding/editing a short professional course entry
const shortCourseValidation = [
    // Course name is required
    body("course_name")
        .trim()
        .notEmpty()
        .withMessage("Course name is required"),
    // Provider name is optional
    body("provider_name").optional().trim(),
    // URL to the course page (optional)
    body("course_url")
        .optional({ values: "falsy" })
        .trim()
        .isURL()
        .withMessage("Must be a valid URL"),
    // Completion date (optional)
    body("completion_date")
        .optional({ values: "falsy" })
        .isDate()
        .withMessage("Must be a valid date"),
];

// Validation rules for adding/editing an employment history entry
const employmentValidation = [
    // Employer name is required
    body("employer_name")
        .trim()
        .notEmpty()
        .withMessage("Employer name is required"),
    // Job title is required
    body("job_title")
        .trim()
        .notEmpty()
        .withMessage("Job title is required"),
    // Start date of the role (optional)
    body("start_date")
        .optional({ values: "falsy" })
        .isDate()
        .withMessage("Must be a valid date"),
    // End date of the role (optional, null if current role)
    body("end_date")
        .optional({ values: "falsy" })
        .isDate()
        .withMessage("Must be a valid date"),
    // Role description: optional, limited to 2000 characters
    body("description")
        .optional()
        .trim()
        .isLength({ max: 2000 })
        .withMessage("Description must be under 2000 characters"),
];

module.exports = {
    profileValidation,
    degreeValidation,
    certificationValidation,
    licenceValidation,
    shortCourseValidation,
    employmentValidation,
};
