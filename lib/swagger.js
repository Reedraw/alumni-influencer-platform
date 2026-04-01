// swagger-jsdoc reads JSDoc annotations from route files to generate OpenAPI spec
const swaggerJsdoc = require("swagger-jsdoc");

// OpenAPI 3.0.0 specification configuration for the Alumni Influencers public API
const options = {
    definition: {
        openapi: "3.0.0", // OpenAPI specification version
        info: {
            title: "Alumni Influencers API", // API title shown in Swagger UI
            version: "1.0.0", // API version
            description:
                "Public API for the Alumni Influencers platform. " +
                "Provides access to featured alumni data for AR clients.",
        },
        servers: [
            {
                url: "http://localhost:3000", // Base URL for API requests
                description: "Development server",
            },
        ],
        components: {
            // Define the Bearer token authentication scheme used by all API endpoints
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer", // Token is sent in Authorization: Bearer <token> header
                    description:
                        "API token obtained from the API key management page",
                },
            },
            // Reusable data model schemas referenced by endpoint documentation
            schemas: {
                // Schema for the full featured alumni response (Alumni of the Day)
                FeaturedAlumni: {
                    type: "object",
                    properties: {
                        id: { type: "string", format: "uuid" }, // Featured record UUID
                        full_name: { type: "string" }, // Alumni's full name
                        email: { type: "string" }, // Alumni's email address
                        biography: { type: "string" }, // Personal biography text
                        linkedin_url: { type: "string" }, // LinkedIn profile link
                        profile_image_url: { type: "string" }, // Path to profile image
                        featured_date: {
                            type: "string",
                            format: "date", // Date they are featured (YYYY-MM-DD)
                        },
                        winning_bid_amount: {
                            type: "number",
                            format: "double", // The bid amount that won the day
                        },
                        // Arrays of professional credentials and experience
                        degrees: {
                            type: "array",
                            items: { $ref: "#/components/schemas/Degree" },
                        },
                        certifications: {
                            type: "array",
                            items: {
                                $ref: "#/components/schemas/Certification",
                            },
                        },
                        licences: {
                            type: "array",
                            items: { $ref: "#/components/schemas/Licence" },
                        },
                        short_courses: {
                            type: "array",
                            items: {
                                $ref: "#/components/schemas/ShortCourse",
                            },
                        },
                        employment: {
                            type: "array",
                            items: {
                                $ref: "#/components/schemas/Employment",
                            },
                        },
                    },
                },
                // Schema for academic degree entries
                Degree: {
                    type: "object",
                    properties: {
                        degree_name: { type: "string" }, // Name of the degree
                        institution_name: { type: "string" }, // University/institution name
                        degree_url: { type: "string" }, // Link to official degree page
                        completion_date: {
                            type: "string",
                            format: "date", // When the degree was completed
                        },
                    },
                },
                // Schema for professional certification entries
                Certification: {
                    type: "object",
                    properties: {
                        certification_name: { type: "string" }, // Name of the certification
                        provider_name: { type: "string" }, // Certification provider/issuer
                        course_url: { type: "string" }, // Link to certification course page
                        completion_date: {
                            type: "string",
                            format: "date", // When the certification was earned
                        },
                    },
                },
                // Schema for professional licence entries
                Licence: {
                    type: "object",
                    properties: {
                        licence_name: { type: "string" }, // Name of the licence
                        awarding_body_name: { type: "string" }, // Organisation that awarded it
                        awarding_body_url: { type: "string" }, // Link to the awarding body
                        completion_date: {
                            type: "string",
                            format: "date", // When the licence was obtained
                        },
                    },
                },
                // Schema for short professional course entries
                ShortCourse: {
                    type: "object",
                    properties: {
                        course_name: { type: "string" }, // Name of the short course
                        provider_name: { type: "string" }, // Course provider
                        course_url: { type: "string" }, // Link to course page
                        completion_date: {
                            type: "string",
                            format: "date", // When the course was completed
                        },
                    },
                },
                // Schema for employment history entries
                Employment: {
                    type: "object",
                    properties: {
                        employer_name: { type: "string" }, // Company/organisation name
                        job_title: { type: "string" }, // Role/position title
                        start_date: {
                            type: "string",
                            format: "date", // When the role started
                        },
                        end_date: {
                            type: "string",
                            format: "date", // When the role ended (null if current)
                        },
                        is_current_role: { type: "boolean" }, // Whether this is the current job
                        description: { type: "string" }, // Role description text
                    },
                },
                // Schema for API error responses
                Error: {
                    type: "object",
                    properties: {
                        error: { type: "string" }, // Human-readable error message
                    },
                },
            },
        },
    },
    // Paths to route files containing @swagger JSDoc annotations
    apis: ["./routes/apiRoutes.js"],
};

// Generate the OpenAPI specification object from the options and JSDoc annotations
const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
