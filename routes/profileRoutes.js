const express = require("express");
const router = express.Router();
const { validationResult } = require("express-validator");

const { getDatabase } = require("../lib/database");
const { requireAuth } = require("../middleware/auth");
const { csrfProtection } = require("../lib/csrf");
const { uploadProfileImage } = require("../lib/upload");
const profiles = require("../queries/profiles");
const users = require("../queries/users");
const {
    profileValidation,
    degreeValidation,
    certificationValidation,
    licenceValidation,
    shortCourseValidation,
    employmentValidation,
} = require("../models/profileSchema");

// All profile routes require authentication
router.use(requireAuth);

// ==================== VIEW PROFILE ====================

router.get("/", async (req, res) => {
    try {
        const db = getDatabase();
        const fullProfile = await profiles.getFullProfile(
            db, req.session.user.id
        );

        if (!fullProfile) {
            return res.redirect("/profile/create");
        }

        const user = await users.getUserById(
            db, req.session.user.id
        );

        res.render("profile/view", {
            profile: fullProfile,
            user,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// ==================== CREATE PROFILE ====================

router.get("/create", async (req, res) => {
    try {
        const db = getDatabase();
        const existing = await profiles.getProfileByUserId(
            db, req.session.user.id
        );

        if (existing) {
            return res.redirect("/profile/edit");
        }

        res.render("profile/create", { errors: [] });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

router.post(
    "/create",
    csrfProtection,
    uploadProfileImage.single("profile_image"),
    profileValidation,
    async (req, res) => {
        try {
            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
                return res.status(400).render("profile/create", {
                    errors: valErrors.array().map((e) => e.msg),
                });
            }

            const db = getDatabase();
            const { biography, linkedin_url } = req.body;

            let profileImagePath = null;
            if (req.file) {
                profileImagePath = `uploads/profiles/${req.file.filename}`;
            }

            await profiles.createProfile(db, {
                userId: req.session.user.id,
                biography,
                linkedinUrl: linkedin_url,
                profileImagePath,
            });

            res.redirect("/profile");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== EDIT PROFILE ====================

router.get("/edit", async (req, res) => {
    try {
        const db = getDatabase();
        const fullProfile = await profiles.getFullProfile(
            db, req.session.user.id
        );

        if (!fullProfile) {
            return res.redirect("/profile/create");
        }

        // Check if editing a sub-item
        const editData = {
            editDegree: null,
            editCertification: null,
            editLicence: null,
            editShortCourse: null,
            editEmployment: null,
        };

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

        res.render("profile/edit", {
            profile: fullProfile,
            errors: [],
            ...editData,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

router.post(
    "/edit",
    csrfProtection,
    profileValidation,
    async (req, res) => {
        try {
            const valErrors = validationResult(req);
            if (!valErrors.isEmpty()) {
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
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            if (!profile) {
                return res.redirect("/profile/create");
            }

            const { biography, linkedin_url } = req.body;

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

router.post(
    "/image",
    csrfProtection,
    uploadProfileImage.single("profile_image"),
    async (req, res) => {
        try {
            const db = getDatabase();
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            if (!profile || !req.file) {
                return res.redirect("/profile/edit");
            }

            const profileImagePath =
                `uploads/profiles/${req.file.filename}`;

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

router.post(
    "/degrees/add",
    csrfProtection,
    degreeValidation,
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
                degree_name,
                institution_name,
                degree_url,
                completion_date,
            } = req.body;

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

router.post(
    "/degrees/:id/edit",
    csrfProtection,
    degreeValidation,
    async (req, res) => {
        try {
            const db = getDatabase();
            const degree = await profiles.getDegreeById(
                db, req.params.id
            );
            const profile = await profiles.getProfileByUserId(
                db, req.session.user.id
            );

            if (!degree || !profile || degree.profile_id !== profile.id) {
                return res.status(403).send("Forbidden");
            }

            const {
                degree_name,
                institution_name,
                degree_url,
                completion_date,
            } = req.body;

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

router.post("/degrees/:id/delete", csrfProtection, async (req, res) => {
    try {
        const db = getDatabase();
        const degree = await profiles.getDegreeById(
            db, req.params.id
        );
        const profile = await profiles.getProfileByUserId(
            db, req.session.user.id
        );

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
                isCurrentRole: is_current_role === "on",
                description,
            });

            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

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
                isCurrentRole: is_current_role === "on",
                description,
            });

            res.redirect("/profile/edit");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

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

module.exports = router;
