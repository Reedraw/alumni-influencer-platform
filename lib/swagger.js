const swaggerJsdoc = require("swagger-jsdoc");

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Alumni Influencers API",
            version: "1.0.0",
            description:
                "Public API for the Alumni Influencers platform. " +
                "Provides access to featured alumni data for AR clients.",
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Development server",
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    description:
                        "API token obtained from the API key management page",
                },
            },
            schemas: {
                FeaturedAlumni: {
                    type: "object",
                    properties: {
                        id: { type: "string", format: "uuid" },
                        full_name: { type: "string" },
                        email: { type: "string" },
                        biography: { type: "string" },
                        linkedin_url: { type: "string" },
                        profile_image_url: { type: "string" },
                        featured_date: {
                            type: "string",
                            format: "date",
                        },
                        winning_bid_amount: {
                            type: "number",
                            format: "double",
                        },
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
                Degree: {
                    type: "object",
                    properties: {
                        degree_name: { type: "string" },
                        institution_name: { type: "string" },
                        degree_url: { type: "string" },
                        completion_date: {
                            type: "string",
                            format: "date",
                        },
                    },
                },
                Certification: {
                    type: "object",
                    properties: {
                        certification_name: { type: "string" },
                        provider_name: { type: "string" },
                        course_url: { type: "string" },
                        completion_date: {
                            type: "string",
                            format: "date",
                        },
                    },
                },
                Licence: {
                    type: "object",
                    properties: {
                        licence_name: { type: "string" },
                        awarding_body_name: { type: "string" },
                        awarding_body_url: { type: "string" },
                        completion_date: {
                            type: "string",
                            format: "date",
                        },
                    },
                },
                ShortCourse: {
                    type: "object",
                    properties: {
                        course_name: { type: "string" },
                        provider_name: { type: "string" },
                        course_url: { type: "string" },
                        completion_date: {
                            type: "string",
                            format: "date",
                        },
                    },
                },
                Employment: {
                    type: "object",
                    properties: {
                        employer_name: { type: "string" },
                        job_title: { type: "string" },
                        start_date: {
                            type: "string",
                            format: "date",
                        },
                        end_date: {
                            type: "string",
                            format: "date",
                        },
                        is_current_role: { type: "boolean" },
                        description: { type: "string" },
                    },
                },
                Error: {
                    type: "object",
                    properties: {
                        error: { type: "string" },
                    },
                },
            },
        },
    },
    apis: ["./routes/apiRoutes.js"],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
