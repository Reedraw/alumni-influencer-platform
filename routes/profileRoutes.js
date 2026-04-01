// Express framework for creating modular route handlers
const express = require("express");
// Create a new router instance for profile-related routes
const router = express.Router();
// express-validator result extractor for checking form validation errors
const { validationResult } = require("express-validator");

// Database connection pool accessor
const { getDatabase } = require("../lib/database");
// Session authentication middleware — redirects to login if not authenticated
const { requireAuth } = require("../middleware/auth");
// CSRF protection middleware to prevent cross-site request forgery
const { csrfProtection } = require("../lib/csrf");
// Multer file upload middleware configured for profile images
const { uploadProfileImage } = require("../lib/upload");
// Database query functions for profile and all sub-sections CRUD
const profiles = require("../queries/profiles");
// Database query functions for user lookups
const users = require("../queries/users");
// Email utilities for sending verification emails and token generation/hashing
const {
    generateToken,
    hashToken,
    sendVerificationEmail,
} = require("../lib/email");
// Database query functions for verification token management
const tokens = require("../queries/tokens");
// Validation schemas for profile and all 5 sub-section forms
const {
    profileValidation,
    degreeValidation,
    certificationValidation,
    licenceValidation,
    shortCourseValidation,
    employmentValidation,
} = require("../models/profileSchema");

// Apply session authentication to ALL profile routes — must be logged in
router.use(requireAuth);

// ==================== VIEW PROFILE ====================

// GET /profile — Display the user's full profile with all sub-sections
router.get("/", async (req, res) => {
    try {
        const db = getDatabase();
        // Load the complete profile with all 5 sub-sections (parallel queries)
        const fullProfile = await profiles.getFullProfile(
            db, req.session.user.id
        );

        // If no profile exists yet, redirect to the creation form
        if (!fullProfile) {
            return res.redirect("/profile/create");
        }

        // Get the user record for displaying name and email on the profile page
        const user = await users.getUserById(
            db, req.session.user.id
        );

        res.render("profile/view", {
            profile: fullProfile,
            user,
            isVerified: req.session.user.is_verified,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// ==================== RESEND VERIFICATION EMAIL ====================

// POST /profile/resend-verification — Resend the email verification link
router.post(
    "/resend-verification",
    csrfProtection,
    async (req, res) => {
        try {
            const db = getDatabase();
            const user = await users.getUserById(
                db, req.session.user.id
            );

            // If user is already verified, just redirect back
            if (!user || user.is_verified) {
                return res.redirect("/profile");
            }

            // Generate a new verification token and hash it for storage
            const rawToken = generateToken();
            const tokenHash = hashToken(rawToken);

            // Store the hashed token in the database (expires in 24 hours)
            await tokens.createEmailVerificationToken(
                db, user.id, tokenHash
            );

            // Send the raw token to the user's email
            sendVerificationEmail(user.email, rawToken);

            res.redirect("/profile");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== CREATE PROFILE ==

// GET /profile/create — Display the profile creation form
router.get("/create", async (req, res) => {
    try {
        const db = getDatabase();
        // Check if user already has a profile (prevent duplicate creation)
        const existing = await profiles.getProfileByUserId(
            db, req.session.user.id
        );

        // If profile already exists, redirect to the edit page instead
        if (existing) {
            return res.redirect("/profile/edit");
        }

        res.render("profile/create", { errors: [] });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// POST /profile/create — Handle profile creation form submission with optional image upload
router.post(
    "/create",
    // IMPORTANT: Multer runs BEFORE CSRF — multer parses multipart form data
    // including the _csrf field, so CSRF validation must happen after parsing
    uploadProfileImage.single("profile_image"),
    csrfProtection,
    profileValidation, // Validate biography and LinkedIn URL
    async (req, res) => {
        try {
            // Check for validation errors from express-validator
            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                return res.status(400).render("profile/create", {
                    errors: valErrors.array().map((e) => e.msg),
                });
            }

            const db = getDatabase();
            const { biography, linkedin_url } = req.body;

            // If a profile image was uploaded, construct its storage path
            let profileImagePath = null;
            if (req.file) {
                profileImagePath = `uploads/profiles/${req.file.filename}`;
            }

            // Create the profile record in the database
            await profiles.createProfile(db, {
                userId: req.session.user.id,
                biography,
                linkedinUrl: linkedin_url,
                profileImagePath,
            });

            // Redirect to the profile view page
            res.redirect("/profile");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== EDIT PROFILE ====================

// GET /profile/edit — Display the profile edit form with all sub-sections
// Also handles inline editing of individual sub-items via query parameters
router.get("/edit", async (req, res) => {
    try {
        const db = getDatabase();
        // Load the complete profile with all sub-sections
        const fullProfile = await profiles.getFullProfile(
            db, req.session.user.id
        );

        // If no profile exists, redirect to creation first
        if (!fullProfile) {
            return res.redirect("/profile/create");
        }

        // Initialise edit data — when a query param like ?editDegree=<id> is present,
        // we load that specific sub-item for inline editing in the form
        const editData = {
            editDegree: null,
            editCertification: null,
            editLicence: null,
            editShortCourse: null,
            editEmployment: null,
        };

        // Check each query parameter and load the corresponding sub-item for editing
        if (req.query.editDegree) {
            editData.editDegree = await profiles.getDegreeById(
                db, req.query.editDegree
            );
        }
        if (req.query.editCertification) {
            editData.editCertification =
                await profiles.getCertificationById(
                    db, req.query.editCertification
                );
        }
        if (req.query.editLicence) {
            editData.editLicence = await profiles.getLicenceById(
                db, req.query.editLicence
            );
        }
        if (req.query.editShortCourse) {
            editData.editShortCourse =
                await profiles.getShortCourseById(
                    db, req.query.editShortCourse
                );
        }
        if (req.query.editEmployment) {
            editData.editEmployment =
                await profiles.getEmploymentById(
                    db, req.query.editEmployment
                );
        }

        // Render the edit form with profile data and any sub-item being edited
        res.render("profile/edit", {
            profile: fullProfile,
            errors: [],
            ...editData, // Spread the edit data (all null unless editing a sub-item)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// POST /profile/edit — Handle profile field updates (biography, LinkedIn URL)
router.post(
    "/edit",
    csrfProtection,
    profileValidation, // Validate biography and LinkedIn URL
    async (req, res) => {
        try {
            // Check for validation errors
            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                // Re-load the full profile to re-render the edit form with errors
                const db = getDatabase();
                const fullProfile = await profiles.getFullProfile(
                    db, req.session.user.id
                );
                return res.status(400).render("profile/edit", {
                    profile: fullProfile,
                    errors: valErrors.array().map((e) => e.msg),
                    editDegree: null,
                    editCertification: null,
                    editLicence: null,
                    editShortCourse: null,
                    editEmployment: null,
                });
            }

            const db = getDatabase();
            // Get the profile to find its ID for the update
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            if (!profile) {
                return res.redirect("/profile/create");
            }

            const { biography, linkedin_url } = req.body;

            // Update only the main profile fields (not sub-sections)
            await profiles.updateProfile(db, profile.id, {
                biography,
                linkedinUrl: linkedin_url,
            });

            res.redirect("/profile");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== PROFILE IMAGE ====================

// POST /profile/image — Upload or update the profile image
router.post(
    "/image",
    // IMPORTANT: Multer runs BEFORE CSRF for multipart form parsing
    uploadProfileImage.single("profile_image"),
    csrfProtection,
    async (req, res) => {
        try {
            const db = getDatabase();
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            // Redirect if no profile exists or no file was uploaded
            if (!profile || !req.file) {
                return res.redirect("/profile/edit");
            }

            // Construct the storage path for the uploaded image
            const profileImagePath =
                `uploads/profiles/${req.file.filename}`;

            // Update the profile's image path in the database
            await profiles.updateProfile(db, profile.id, {
                profileImagePath,
            });

            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== DEGREES ====================

// POST /profile/degrees/add — Add a new degree to the user's profile
router.post(
    "/degrees/add",
    csrfProtection,
    degreeValidation, // Validate degree name, institution, URL, date
    async (req, res) => {
        try {
            const db = getDatabase();
            // Get the user's profile (degrees belong to profiles, not users directly)
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            if (!profile) return res.redirect("/profile/create");

            // Check for validation errors
            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                return res.redirect("/profile/edit");
            }

            // Extract form fields (snake_case from HTML form, converted to camelCase)
            const {
                degree_name,
                institution_name,
                degree_url,
                completion_date,
            } = req.body;

            // Add the degree to the database
            await profiles.addDegree(db, profile.id, {
                degreeName: degree_name,
                institutionName: institution_name,
                degreeUrl: degree_url,
                completionDate: completion_date,
            });

            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// POST /profile/degrees/:id/edit — Update an existing degree record
router.post(
    "/degrees/:id/edit",
    csrfProtection,
    degreeValidation,
    async (req, res) => {
        try {
            const db = getDatabase();
            // Load the degree record to verify it exists
            const degree = await profiles.getDegreeById(
                db, req.params.id
            );
            // Load the user's profile for ownership verification
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            // SECURITY: Verify the degree belongs to the logged-in user's profile
            if (!degree || !profile || degree.profile_id !== profile.id) {
                return res.status(403).send("Forbidden");
            }

            const {
                degree_name,
                institution_name,
                degree_url,
                completion_date,
            } = req.body;

            // Update the degree record
            await profiles.updateDegree(db, req.params.id, {
                degreeName: degree_name,
                institutionName: institution_name,
                degreeUrl: degree_url,
                completionDate: completion_date,
            });

            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// POST /profile/degrees/:id/delete — Delete a degree record
router.post("/degrees/:id/delete", csrfProtection, async (req, res) => {
    try {
        const db = getDatabase();
        const degree = await profiles.getDegreeById(
            db, req.params.id
        );
        const profile = await profiles.getProfileByUserId(
            db, req.session.user.id
        );

        // SECURITY: Verify ownership before allowing deletion
        if (!degree || !profile || degree.profile_id !== profile.id) {
            return res.status(403).send("Forbidden");
        }

        await profiles.deleteDegree(db, req.params.id);
        res.redirect("/profile/edit");
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// ==================== CERTIFICATIONS ====================

// POST /profile/certifications/add — Add a new certification
router.post(
    "/certifications/add",
    csrfProtection,
    certificationValidation,
    async (req, res) => {
        try {
            const db = getDatabase();
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            if (!profile) return res.redirect("/profile/create");

            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                return res.redirect("/profile/edit");
            }

            const {
                certification_name,
                provider_name,
                course_url,
                completion_date,
            } = req.body;

            await profiles.addCertification(db, profile.id, {
                certificationName: certification_name,
                providerName: provider_name,
                courseUrl: course_url,
                completionDate: completion_date,
            });

            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// POST /profile/certifications/:id/edit — Update an existing certification
router.post(
    "/certifications/:id/edit",
    csrfProtection,
    certificationValidation,
    async (req, res) => {
        try {
            const db = getDatabase();
            const cert = await profiles.getCertificationById(
                db, req.params.id
            );
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            // SECURITY: Verify the certification belongs to the user's profile
            if (!cert || !profile || cert.profile_id !== profile.id) {
                return res.status(403).send("Forbidden");
            }

            const {
                certification_name,
                provider_name,
                course_url,
                completion_date,
            } = req.body;

            await profiles.updateCertification(db, req.params.id, {
                certificationName: certification_name,
                providerName: provider_name,
                courseUrl: course_url,
                completionDate: completion_date,
            });

            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// POST /profile/certifications/:id/delete — Delete a certification
router.post(
    "/certifications/:id/delete",
    csrfProtection,
    async (req, res) => {
        try {
            const db = getDatabase();
            const cert = await profiles.getCertificationById(
                db, req.params.id
            );
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            // SECURITY: Verify ownership before deletion
            if (!cert || !profile || cert.profile_id !== profile.id) {
                return res.status(403).send("Forbidden");
            }

            await profiles.deleteCertification(db, req.params.id);
            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== LICENCES ====================

// POST /profile/licences/add — Add a new professional licence
router.post(
    "/licences/add",
    csrfProtection,
    licenceValidation,
    async (req, res) => {
        try {
            const db = getDatabase();
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            if (!profile) return res.redirect("/profile/create");

            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                return res.redirect("/profile/edit");
            }

            const {
                licence_name,
                awarding_body_name,
                awarding_body_url,
                completion_date,
            } = req.body;

            await profiles.addLicence(db, profile.id, {
                licenceName: licence_name,
                awardingBodyName: awarding_body_name,
                awardingBodyUrl: awarding_body_url,
                completionDate: completion_date,
            });

            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// POST /profile/licences/:id/edit — Update an existing licence
router.post(
    "/licences/:id/edit",
    csrfProtection,
    licenceValidation,
    async (req, res) => {
        try {
            const db = getDatabase();
            const licence = await profiles.getLicenceById(
                db, req.params.id
            );
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            // SECURITY: Verify the licence belongs to the user's profile
            if (
                !licence || !profile ||
                licence.profile_id !== profile.id
            ) {
                return res.status(403).send("Forbidden");
            }

            const {
                licence_name,
                awarding_body_name,
                awarding_body_url,
                completion_date,
            } = req.body;

            await profiles.updateLicence(db, req.params.id, {
                licenceName: licence_name,
                awardingBodyName: awarding_body_name,
                awardingBodyUrl: awarding_body_url,
                completionDate: completion_date,
            });

            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// POST /profile/licences/:id/delete — Delete a licence
router.post(
    "/licences/:id/delete",
    csrfProtection,
    async (req, res) => {
        try {
            const db = getDatabase();
            const licence = await profiles.getLicenceById(
                db, req.params.id
            );
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            // SECURITY: Verify ownership before deletion
            if (
                !licence || !profile ||
                licence.profile_id !== profile.id
            ) {
                return res.status(403).send("Forbidden");
            }

            await profiles.deleteLicence(db, req.params.id);
            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== SHORT COURSES ====================

// POST /profile/courses/add — Add a new short course
router.post(
    "/courses/add",
    csrfProtection,
    shortCourseValidation,
    async (req, res) => {
        try {
            const db = getDatabase();
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            if (!profile) return res.redirect("/profile/create");

            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                return res.redirect("/profile/edit");
            }

            const {
                course_name,
                provider_name,
                course_url,
                completion_date,
            } = req.body;

            await profiles.addShortCourse(db, profile.id, {
                courseName: course_name,
                providerName: provider_name,
                courseUrl: course_url,
                completionDate: completion_date,
            });

            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// POST /profile/courses/:id/edit — Update an existing short course
router.post(
    "/courses/:id/edit",
    csrfProtection,
    shortCourseValidation,
    async (req, res) => {
        try {
            const db = getDatabase();
            const course = await profiles.getShortCourseById(
                db, req.params.id
            );
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            // SECURITY: Verify the course belongs to the user's profile
            if (!course || !profile ||
                course.profile_id !== profile.id) {
                return res.status(403).send("Forbidden");
            }

            const {
                course_name,
                provider_name,
                course_url,
                completion_date,
            } = req.body;

            await profiles.updateShortCourse(db, req.params.id, {
                courseName: course_name,
                providerName: provider_name,
                courseUrl: course_url,
                completionDate: completion_date,
            });

            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// POST /profile/courses/:id/delete — Delete a short course
router.post(
    "/courses/:id/delete",
    csrfProtection,
    async (req, res) => {
        try {
            const db = getDatabase();
            const course = await profiles.getShortCourseById(
                db, req.params.id
            );
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            // SECURITY: Verify ownership before deletion
            if (!course || !profile ||
                course.profile_id !== profile.id) {
                return res.status(403).send("Forbidden");
            }

            await profiles.deleteShortCourse(db, req.params.id);
            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== EMPLOYMENT HISTORY ====================

// POST /profile/employment/add — Add a new employment record
router.post(
    "/employment/add",
    csrfProtection,
    employmentValidation,
    async (req, res) => {
        try {
            const db = getDatabase();
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            if (!profile) return res.redirect("/profile/create");

            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                return res.redirect("/profile/edit");
            }

            const {
                employer_name,
                job_title,
                start_date,
                end_date,
                is_current_role,
                description,
            } = req.body;

            await profiles.addEmployment(db, profile.id, {
                employerName: employer_name,
                jobTitle: job_title,
                startDate: start_date,
                endDate: end_date,
                isCurrentRole: is_current_role === "on", // Checkbox value is "on" when checked
                description,
            });

            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// POST /profile/employment/:id/edit — Update an existing employment record
router.post(
    "/employment/:id/edit",
    csrfProtection,
    employmentValidation,
    async (req, res) => {
        try {
            const db = getDatabase();
            const emp = await profiles.getEmploymentById(
                db, req.params.id
            );
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            // SECURITY: Verify the employment record belongs to the user's profile
            if (!emp || !profile || emp.profile_id !== profile.id) {
                return res.status(403).send("Forbidden");
            }

            const {
                employer_name,
                job_title,
                start_date,
                end_date,
                is_current_role,
                description,
            } = req.body;

            await profiles.updateEmployment(db, req.params.id, {
                employerName: employer_name,
                jobTitle: job_title,
                startDate: start_date,
                endDate: end_date,
                isCurrentRole: is_current_role === "on", // Checkbox value conversion
                description,
            });

            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// POST /profile/employment/:id/delete — Delete an employment record
router.post(
    "/employment/:id/delete",
    csrfProtection,
    async (req, res) => {
        try {
            const db = getDatabase();
            const emp = await profiles.getEmploymentById(
                db, req.params.id
            );
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            // SECURITY: Verify ownership before deletion
            if (!emp || !profile || emp.profile_id !== profile.id) {
                return res.status(403).send("Forbidden");
            }

            await profiles.deleteEmployment(db, req.params.id);
            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// Export the router for mounting in app.js
module.exports = router;
