const { body } = require("express-validator");

const profileValidation = [
    body("biography")
        .optional()
        .trim()
        .isLength({ max: 5000 })
        .withMessage("Biography must be under 5000 characters"),
    body("linkedin_url")
        .optional({ values: "falsy" })
        .trim()
        .isURL()
        .withMessage("Must be a valid URL"),
];

const degreeValidation = [
    body("degree_name")
        .trim()
        .notEmpty()
        .withMessage("Degree name is required"),
    body("institution_name").optional().trim(),
    body("degree_url")
        .optional({ values: "falsy" })
        .trim()
        .isURL()
        .withMessage("Must be a valid URL"),
    body("completion_date")
        .optional({ values: "falsy" })
        .isDate()
        .withMessage("Must be a valid date"),
];

const certificationValidation = [
    body("certification_name")
        .trim()
        .notEmpty()
        .withMessage("Certification name is required"),
    body("provider_name").optional().trim(),
    body("course_url")
        .optional({ values: "falsy" })
        .trim()
        .isURL()
        .withMessage("Must be a valid URL"),
    body("completion_date")
        .optional({ values: "falsy" })
        .isDate()
        .withMessage("Must be a valid date"),
];

const licenceValidation = [
    body("licence_name")
        .trim()
        .notEmpty()
        .withMessage("Licence name is required"),
    body("awarding_body_name").optional().trim(),
    body("awarding_body_url")
        .optional({ values: "falsy" })
        .trim()
        .isURL()
        .withMessage("Must be a valid URL"),
    body("completion_date")
        .optional({ values: "falsy" })
        .isDate()
        .withMessage("Must be a valid date"),
];

const shortCourseValidation = [
    body("course_name")
        .trim()
        .notEmpty()
        .withMessage("Course name is required"),
    body("provider_name").optional().trim(),
    body("course_url")
        .optional({ values: "falsy" })
        .trim()
        .isURL()
        .withMessage("Must be a valid URL"),
    body("completion_date")
        .optional({ values: "falsy" })
        .isDate()
        .withMessage("Must be a valid date"),
];

const employmentValidation = [
    body("employer_name")
        .trim()
        .notEmpty()
        .withMessage("Employer name is required"),
    body("job_title")
        .trim()
        .notEmpty()
        .withMessage("Job title is required"),
    body("start_date")
        .optional({ values: "falsy" })
        .isDate()
        .withMessage("Must be a valid date"),
    body("end_date")
        .optional({ values: "falsy" })
        .isDate()
        .withMessage("Must be a valid date"),
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
