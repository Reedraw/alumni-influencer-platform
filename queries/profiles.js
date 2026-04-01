// UUID generator for creating unique record IDs across all profile tables
const { v4: uuidv4 } = require("uuid");

// ==================== ALUMNI PROFILES ====================

/**
 * Create a new alumni profile for a user.
 * Each user can have at most one profile. The profile serves as the main
 * container for all sub-sections (degrees, certifications, licences, etc.).
 * @param {object} db - MySQL connection pool
 * @param {object} data - Profile data fields
 * @param {string} data.userId - UUID of the user this profile belongs to
 * @param {string|null} data.biography - User's bio text (optional)
 * @param {string|null} data.linkedinUrl - User's LinkedIn profile URL (optional)
 * @param {string|null} data.profileImagePath - Path to uploaded profile image (optional)
 * @returns {Promise<string>} The UUID of the newly created profile
 */
async function createProfile(db, {
    userId,
    biography,
    linkedinUrl,
    profileImagePath,
}) {
    const id = uuidv4(); // Generate unique ID for this profile
    // Insert profile using parameterised query to prevent SQL injection
    await db.execute(
        `INSERT INTO alumni_profiles
            (id, user_id, biography, linkedin_url, profile_image_path)
         VALUES (?, ?, ?, ?, ?)`,
        [
            id,
            userId,
            biography || null, // Store null instead of empty string
            linkedinUrl || null,
            profileImagePath || null,
        ]
    );
    return id;
}

/**
 * Get a user's alumni profile by their user ID.
 * Returns null if the user hasn't created a profile yet.
 * @param {object} db - MySQL connection pool
 * @param {string} userId - UUID of the user
 * @returns {Promise<object|null>} The profile record or null
 */
async function getProfileByUserId(db, userId) {
    const [rows] = await db.execute(
        `SELECT * FROM alumni_profiles WHERE user_id = ? LIMIT 1`,
        [userId]
    );
    return rows[0] || null;
}

/**
 * Update an existing alumni profile's fields.
 * Uses dynamic query building — only updates fields that are provided,
 * allowing partial updates without overwriting unspecified fields.
 * @param {object} db - MySQL connection pool
 * @param {string} profileId - UUID of the profile to update
 * @param {object} data - Fields to update (only provided fields are changed)
 * @param {string} [data.biography] - Updated biography text
 * @param {string} [data.linkedinUrl] - Updated LinkedIn URL
 * @param {string} [data.profileImagePath] - Updated profile image path
 * @returns {Promise<boolean>} True if a row was updated, false if nothing to update
 */
async function updateProfile(db, profileId, {
    biography,
    linkedinUrl,
    profileImagePath,
}) {
    const fields = []; // SQL SET clause fragments
    const values = []; // Corresponding parameterised values

    // Only add fields that were explicitly provided in the update
    if (biography !== undefined) {
        fields.push("biography = ?");
        values.push(biography);
    }
    if (linkedinUrl !== undefined) {
        fields.push("linkedin_url = ?");
        values.push(linkedinUrl);
    }
    if (profileImagePath !== undefined) {
        fields.push("profile_image_path = ?");
        values.push(profileImagePath);
    }

    // Return false if no fields were provided to update
    if (fields.length === 0) return false;

    // Add the profile ID as the last parameter for the WHERE clause
    values.push(profileId);
    // Build and execute the dynamic UPDATE query
    const [result] = await db.execute(
        `UPDATE alumni_profiles SET ${fields.join(", ")} WHERE id = ?`,
        values
    );
    return result.affectedRows === 1; // True if the profile was found and updated
}

// ==================== DEGREES ====================

/**
 * Add a degree record to a user's profile.
 * @param {object} db - MySQL connection pool
 * @param {string} profileId - UUID of the alumni profile
 * @param {object} data - Degree data
 * @returns {Promise<string>} The UUID of the newly created degree record
 */
async function addDegree(db, profileId, {
    degreeName,
    institutionName,
    degreeUrl,
    completionDate,
}) {
    const id = uuidv4(); // Unique ID for this degree record
    await db.execute(
        `INSERT INTO profile_degrees
            (id, profile_id, degree_name, institution_name,
             degree_url, completion_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            id, profileId, degreeName,
            institutionName || null,
            degreeUrl || null,
            completionDate || null,
        ]
    );
    return id;
}

/**
 * Get all degrees belonging to a specific profile.
 * @param {object} db - MySQL connection pool
 * @param {string} profileId - UUID of the alumni profile
 * @returns {Promise<Array>} Array of degree records
 */
async function getDegreesByProfileId(db, profileId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_degrees WHERE profile_id = ?`,
        [profileId]
    );
    return rows;
}

/**
 * Get a single degree record by its ID (for editing/deleting with ownership check).
 * @param {object} db - MySQL connection pool
 * @param {string} degreeId - UUID of the degree record
 * @returns {Promise<object|null>} The degree record or null
 */
async function getDegreeById(db, degreeId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_degrees WHERE id = ? LIMIT 1`,
        [degreeId]
    );
    return rows[0] || null;
}

/**
 * Update an existing degree record with new values.
 * @param {object} db - MySQL connection pool
 * @param {string} degreeId - UUID of the degree to update
 * @param {object} data - Updated degree data
 * @returns {Promise<boolean>} True if the record was updated
 */
async function updateDegree(db, degreeId, {
    degreeName,
    institutionName,
    degreeUrl,
    completionDate,
}) {
    const [result] = await db.execute(
        `UPDATE profile_degrees
         SET degree_name = ?, institution_name = ?,
             degree_url = ?, completion_date = ?
         WHERE id = ?`,
        [
            degreeName,
            institutionName || null,
            degreeUrl || null,
            completionDate || null,
            degreeId,
        ]
    );
    return result.affectedRows === 1;
}

/**
 * Delete a degree record from a profile.
 * @param {object} db - MySQL connection pool
 * @param {string} degreeId - UUID of the degree to delete
 * @returns {Promise<boolean>} True if the record was deleted
 */
async function deleteDegree(db, degreeId) {
    const [result] = await db.execute(
        `DELETE FROM profile_degrees WHERE id = ?`,
        [degreeId]
    );
    return result.affectedRows === 1;
}

// ==================== CERTIFICATIONS ====================

/**
 * Add a certification record to a user's profile.
 * @param {object} db - MySQL connection pool
 * @param {string} profileId - UUID of the alumni profile
 * @param {object} data - Certification data
 * @returns {Promise<string>} The UUID of the newly created certification record
 */
async function addCertification(db, profileId, {
    certificationName,
    providerName,
    courseUrl,
    completionDate,
}) {
    const id = uuidv4(); // Unique ID for this certification record
    await db.execute(
        `INSERT INTO profile_certifications
            (id, profile_id, certification_name, provider_name,
             course_url, completion_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            id, profileId, certificationName,
            providerName || null,
            courseUrl || null,
            completionDate || null,
        ]
    );
    return id;
}

/**
 * Get all certifications belonging to a specific profile.
 * @param {object} db - MySQL connection pool
 * @param {string} profileId - UUID of the alumni profile
 * @returns {Promise<Array>} Array of certification records
 */
async function getCertificationsByProfileId(db, profileId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_certifications WHERE profile_id = ?`,
        [profileId]
    );
    return rows;
}

/**
 * Get a single certification record by its ID (for editing/deleting).
 * @param {object} db - MySQL connection pool
 * @param {string} certId - UUID of the certification record
 * @returns {Promise<object|null>} The certification record or null
 */
async function getCertificationById(db, certId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_certifications WHERE id = ? LIMIT 1`,
        [certId]
    );
    return rows[0] || null;
}

/**
 * Update an existing certification record with new values.
 * @param {object} db - MySQL connection pool
 * @param {string} certId - UUID of the certification to update
 * @param {object} data - Updated certification data
 * @returns {Promise<boolean>} True if the record was updated
 */
async function updateCertification(db, certId, {
    certificationName,
    providerName,
    courseUrl,
    completionDate,
}) {
    const [result] = await db.execute(
        `UPDATE profile_certifications
         SET certification_name = ?, provider_name = ?,
             course_url = ?, completion_date = ?
         WHERE id = ?`,
        [
            certificationName,
            providerName || null,
            courseUrl || null,
            completionDate || null,
            certId,
        ]
    );
    return result.affectedRows === 1;
}

/**
 * Delete a certification record from a profile.
 * @param {object} db - MySQL connection pool
 * @param {string} certId - UUID of the certification to delete
 * @returns {Promise<boolean>} True if the record was deleted
 */
async function deleteCertification(db, certId) {
    const [result] = await db.execute(
        `DELETE FROM profile_certifications WHERE id = ?`,
        [certId]
    );
    return result.affectedRows === 1;
}

// ==================== LICENCES ====================

/**
 * Add a professional licence record to a user's profile.
 * @param {object} db - MySQL connection pool
 * @param {string} profileId - UUID of the alumni profile
 * @param {object} data - Licence data
 * @returns {Promise<string>} The UUID of the newly created licence record
 */
async function addLicence(db, profileId, {
    licenceName,
    awardingBodyName,
    awardingBodyUrl,
    completionDate,
}) {
    const id = uuidv4(); // Unique ID for this licence record
    await db.execute(
        `INSERT INTO profile_licences
            (id, profile_id, licence_name, awarding_body_name,
             awarding_body_url, completion_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            id, profileId, licenceName,
            awardingBodyName || null,
            awardingBodyUrl || null,
            completionDate || null,
        ]
    );
    return id;
}

/**
 * Get all licences belonging to a specific profile.
 * @param {object} db - MySQL connection pool
 * @param {string} profileId - UUID of the alumni profile
 * @returns {Promise<Array>} Array of licence records
 */
async function getLicencesByProfileId(db, profileId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_licences WHERE profile_id = ?`,
        [profileId]
    );
    return rows;
}

/**
 * Get a single licence record by its ID (for editing/deleting).
 * @param {object} db - MySQL connection pool
 * @param {string} licenceId - UUID of the licence record
 * @returns {Promise<object|null>} The licence record or null
 */
async function getLicenceById(db, licenceId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_licences WHERE id = ? LIMIT 1`,
        [licenceId]
    );
    return rows[0] || null;
}

/**
 * Update an existing licence record with new values.
 * @param {object} db - MySQL connection pool
 * @param {string} licenceId - UUID of the licence to update
 * @param {object} data - Updated licence data
 * @returns {Promise<boolean>} True if the record was updated
 */
async function updateLicence(db, licenceId, {
    licenceName,
    awardingBodyName,
    awardingBodyUrl,
    completionDate,
}) {
    const [result] = await db.execute(
        `UPDATE profile_licences
         SET licence_name = ?, awarding_body_name = ?,
             awarding_body_url = ?, completion_date = ?
         WHERE id = ?`,
        [
            licenceName,
            awardingBodyName || null,
            awardingBodyUrl || null,
            completionDate || null,
            licenceId,
        ]
    );
    return result.affectedRows === 1;
}

/**
 * Delete a licence record from a profile.
 * @param {object} db - MySQL connection pool
 * @param {string} licenceId - UUID of the licence to delete
 * @returns {Promise<boolean>} True if the record was deleted
 */
async function deleteLicence(db, licenceId) {
    const [result] = await db.execute(
        `DELETE FROM profile_licences WHERE id = ?`,
        [licenceId]
    );
    return result.affectedRows === 1;
}

// ==================== SHORT COURSES ====================

/**
 * Add a short course record to a user's profile.
 * @param {object} db - MySQL connection pool
 * @param {string} profileId - UUID of the alumni profile
 * @param {object} data - Short course data
 * @returns {Promise<string>} The UUID of the newly created short course record
 */
async function addShortCourse(db, profileId, {
    courseName,
    providerName,
    courseUrl,
    completionDate,
}) {
    const id = uuidv4(); // Unique ID for this short course record
    await db.execute(
        `INSERT INTO profile_short_courses
            (id, profile_id, course_name, provider_name,
             course_url, completion_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            id, profileId, courseName,
            providerName || null,
            courseUrl || null,
            completionDate || null,
        ]
    );
    return id;
}

/**
 * Get all short courses belonging to a specific profile.
 * @param {object} db - MySQL connection pool
 * @param {string} profileId - UUID of the alumni profile
 * @returns {Promise<Array>} Array of short course records
 */
async function getShortCoursesByProfileId(db, profileId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_short_courses WHERE profile_id = ?`,
        [profileId]
    );
    return rows;
}

/**
 * Get a single short course record by its ID (for editing/deleting).
 * @param {object} db - MySQL connection pool
 * @param {string} courseId - UUID of the short course record
 * @returns {Promise<object|null>} The short course record or null
 */
async function getShortCourseById(db, courseId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_short_courses WHERE id = ? LIMIT 1`,
        [courseId]
    );
    return rows[0] || null;
}

/**
 * Update an existing short course record with new values.
 * @param {object} db - MySQL connection pool
 * @param {string} courseId - UUID of the short course to update
 * @param {object} data - Updated short course data
 * @returns {Promise<boolean>} True if the record was updated
 */
async function updateShortCourse(db, courseId, {
    courseName,
    providerName,
    courseUrl,
    completionDate,
}) {
    const [result] = await db.execute(
        `UPDATE profile_short_courses
         SET course_name = ?, provider_name = ?,
             course_url = ?, completion_date = ?
         WHERE id = ?`,
        [
            courseName,
            providerName || null,
            courseUrl || null,
            completionDate || null,
            courseId,
        ]
    );
    return result.affectedRows === 1;
}

/**
 * Delete a short course record from a profile.
 * @param {object} db - MySQL connection pool
 * @param {string} courseId - UUID of the short course to delete
 * @returns {Promise<boolean>} True if the record was deleted
 */
async function deleteShortCourse(db, courseId) {
    const [result] = await db.execute(
        `DELETE FROM profile_short_courses WHERE id = ?`,
        [courseId]
    );
    return result.affectedRows === 1;
}

// ==================== EMPLOYMENT HISTORY ====================

/**
 * Add an employment history record to a user's profile.
 * @param {object} db - MySQL connection pool
 * @param {string} profileId - UUID of the alumni profile
 * @param {object} data - Employment data
 * @returns {Promise<string>} The UUID of the newly created employment record
 */
async function addEmployment(db, profileId, {
    employerName,
    jobTitle,
    startDate,
    endDate,
    isCurrentRole,
    description,
}) {
    const id = uuidv4(); // Unique ID for this employment record
    await db.execute(
        `INSERT INTO employment_history
            (id, profile_id, employer_name, job_title,
             start_date, end_date, is_current_role, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id, profileId, employerName, jobTitle,
            startDate || null,
            endDate || null, // Null if this is a current role
            isCurrentRole || false, // Boolean flag for current employment
            description || null,
        ]
    );
    return id;
}

/**
 * Get all employment records for a profile, ordered by start date (newest first).
 * @param {object} db - MySQL connection pool
 * @param {string} profileId - UUID of the alumni profile
 * @returns {Promise<Array>} Array of employment records, most recent first
 */
async function getEmploymentByProfileId(db, profileId) {
    const [rows] = await db.execute(
        `SELECT * FROM employment_history
         WHERE profile_id = ?
         ORDER BY start_date DESC`,
        [profileId]
    );
    return rows;
}

/**
 * Get a single employment record by its ID (for editing/deleting).
 * @param {object} db - MySQL connection pool
 * @param {string} employmentId - UUID of the employment record
 * @returns {Promise<object|null>} The employment record or null
 */
async function getEmploymentById(db, employmentId) {
    const [rows] = await db.execute(
        `SELECT * FROM employment_history WHERE id = ? LIMIT 1`,
        [employmentId]
    );
    return rows[0] || null;
}

/**
 * Update an existing employment record with new values.
 * @param {object} db - MySQL connection pool
 * @param {string} employmentId - UUID of the employment record to update
 * @param {object} data - Updated employment data
 * @returns {Promise<boolean>} True if the record was updated
 */
async function updateEmployment(db, employmentId, {
    employerName,
    jobTitle,
    startDate,
    endDate,
    isCurrentRole,
    description,
}) {
    const [result] = await db.execute(
        `UPDATE employment_history
         SET employer_name = ?, job_title = ?,
             start_date = ?, end_date = ?,
             is_current_role = ?, description = ?
         WHERE id = ?`,
        [
            employerName, jobTitle,
            startDate || null,
            endDate || null,
            isCurrentRole || false,
            description || null,
            employmentId,
        ]
    );
    return result.affectedRows === 1;
}

/**
 * Delete an employment record from a profile.
 * @param {object} db - MySQL connection pool
 * @param {string} employmentId - UUID of the employment record to delete
 * @returns {Promise<boolean>} True if the record was deleted
 */
async function deleteEmployment(db, employmentId) {
    const [result] = await db.execute(
        `DELETE FROM employment_history WHERE id = ?`,
        [employmentId]
    );
    return result.affectedRows === 1;
}

// ==================== FULL PROFILE ====================

/**
 * Get a complete alumni profile with all five sub-sections loaded.
 * Uses Promise.all to fetch all sub-sections in parallel for performance,
 * rather than making 5 sequential database queries.
 * Returns null if the user hasn't created a profile yet.
 * @param {object} db - MySQL connection pool
 * @param {string} userId - UUID of the user
 * @returns {Promise<object|null>} Full profile with degrees, certifications,
 *   licences, shortCourses, and employment arrays — or null if no profile
 */
async function getFullProfile(db, userId) {
    // First get the base profile record
    const profile = await getProfileByUserId(db, userId);
    if (!profile) return null; // No profile created yet

    // Fetch all 5 sub-sections in parallel using Promise.all for efficiency
    const [degrees, certifications, licences, shortCourses, employment] =
        await Promise.all([
            getDegreesByProfileId(db, profile.id),
            getCertificationsByProfileId(db, profile.id),
            getLicencesByProfileId(db, profile.id),
            getShortCoursesByProfileId(db, profile.id),
            getEmploymentByProfileId(db, profile.id),
        ]);

    // Merge all sub-sections into a single profile object
    return {
        ...profile,
        degrees,
        certifications,
        licences,
        shortCourses,
        employment,
    };
}

// Export all profile and sub-section CRUD functions
module.exports = {
    createProfile,
    getProfileByUserId,
    updateProfile,
    addDegree,
    getDegreesByProfileId,
    getDegreeById,
    updateDegree,
    deleteDegree,
    addCertification,
    getCertificationsByProfileId,
    getCertificationById,
    updateCertification,
    deleteCertification,
    addLicence,
    getLicencesByProfileId,
    getLicenceById,
    updateLicence,
    deleteLicence,
    addShortCourse,
    getShortCoursesByProfileId,
    getShortCourseById,
    updateShortCourse,
    deleteShortCourse,
    addEmployment,
    getEmploymentByProfileId,
    getEmploymentById,
    updateEmployment,
    deleteEmployment,
    getFullProfile,
};
