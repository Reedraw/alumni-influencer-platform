const { v4: uuidv4 } = require("uuid");

// ==================== ALUMNI PROFILES ====================

/**
 * Create a new alumni profile
 * @param {object} db - Database pool
 * @param {object} data - Profile data
 * @returns {Promise<string>} Profile ID
 */
async function createProfile(db, {
    userId,
    biography,
    linkedinUrl,
    profileImagePath,
}) {
    const id = uuidv4();
    await db.execute(
        `INSERT INTO alumni_profiles
            (id, user_id, biography, linkedin_url, profile_image_path)
         VALUES (?, ?, ?, ?, ?)`,
        [
            id,
            userId,
            biography || null,
            linkedinUrl || null,
            profileImagePath || null,
        ]
    );
    return id;
}

/**
 * Get profile by user ID
 */
async function getProfileByUserId(db, userId) {
    const [rows] = await db.execute(
        `SELECT * FROM alumni_profiles WHERE user_id = ? LIMIT 1`,
        [userId]
    );
    return rows[0] || null;
}

/**
 * Update profile fields
 */
async function updateProfile(db, profileId, {
    biography,
    linkedinUrl,
    profileImagePath,
}) {
    const fields = [];
    const values = [];

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

    if (fields.length === 0) return false;

    values.push(profileId);
    const [result] = await db.execute(
        `UPDATE alumni_profiles SET ${fields.join(", ")} WHERE id = ?`,
        values
    );
    return result.affectedRows === 1;
}

// ==================== DEGREES ====================

async function addDegree(db, profileId, {
    degreeName,
    institutionName,
    degreeUrl,
    completionDate,
}) {
    const id = uuidv4();
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

async function getDegreesByProfileId(db, profileId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_degrees WHERE profile_id = ?`,
        [profileId]
    );
    return rows;
}

async function getDegreeById(db, degreeId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_degrees WHERE id = ? LIMIT 1`,
        [degreeId]
    );
    return rows[0] || null;
}

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

async function deleteDegree(db, degreeId) {
    const [result] = await db.execute(
        `DELETE FROM profile_degrees WHERE id = ?`,
        [degreeId]
    );
    return result.affectedRows === 1;
}

// ==================== CERTIFICATIONS ====================

async function addCertification(db, profileId, {
    certificationName,
    providerName,
    courseUrl,
    completionDate,
}) {
    const id = uuidv4();
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

async function getCertificationsByProfileId(db, profileId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_certifications WHERE profile_id = ?`,
        [profileId]
    );
    return rows;
}

async function getCertificationById(db, certId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_certifications WHERE id = ? LIMIT 1`,
        [certId]
    );
    return rows[0] || null;
}

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

async function deleteCertification(db, certId) {
    const [result] = await db.execute(
        `DELETE FROM profile_certifications WHERE id = ?`,
        [certId]
    );
    return result.affectedRows === 1;
}

// ==================== LICENCES ====================

async function addLicence(db, profileId, {
    licenceName,
    awardingBodyName,
    awardingBodyUrl,
    completionDate,
}) {
    const id = uuidv4();
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

async function getLicencesByProfileId(db, profileId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_licences WHERE profile_id = ?`,
        [profileId]
    );
    return rows;
}

async function getLicenceById(db, licenceId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_licences WHERE id = ? LIMIT 1`,
        [licenceId]
    );
    return rows[0] || null;
}

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

async function deleteLicence(db, licenceId) {
    const [result] = await db.execute(
        `DELETE FROM profile_licences WHERE id = ?`,
        [licenceId]
    );
    return result.affectedRows === 1;
}

// ==================== SHORT COURSES ====================

async function addShortCourse(db, profileId, {
    courseName,
    providerName,
    courseUrl,
    completionDate,
}) {
    const id = uuidv4();
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

async function getShortCoursesByProfileId(db, profileId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_short_courses WHERE profile_id = ?`,
        [profileId]
    );
    return rows;
}

async function getShortCourseById(db, courseId) {
    const [rows] = await db.execute(
        `SELECT * FROM profile_short_courses WHERE id = ? LIMIT 1`,
        [courseId]
    );
    return rows[0] || null;
}

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

async function deleteShortCourse(db, courseId) {
    const [result] = await db.execute(
        `DELETE FROM profile_short_courses WHERE id = ?`,
        [courseId]
    );
    return result.affectedRows === 1;
}

// ==================== EMPLOYMENT HISTORY ====================

async function addEmployment(db, profileId, {
    employerName,
    jobTitle,
    startDate,
    endDate,
    isCurrentRole,
    description,
}) {
    const id = uuidv4();
    await db.execute(
        `INSERT INTO employment_history
            (id, profile_id, employer_name, job_title,
             start_date, end_date, is_current_role, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            id, profileId, employerName, jobTitle,
            startDate || null,
            endDate || null,
            isCurrentRole || false,
            description || null,
        ]
    );
    return id;
}

async function getEmploymentByProfileId(db, profileId) {
    const [rows] = await db.execute(
        `SELECT * FROM employment_history
         WHERE profile_id = ?
         ORDER BY start_date DESC`,
        [profileId]
    );
    return rows;
}

async function getEmploymentById(db, employmentId) {
    const [rows] = await db.execute(
        `SELECT * FROM employment_history WHERE id = ? LIMIT 1`,
        [employmentId]
    );
    return rows[0] || null;
}

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

async function deleteEmployment(db, employmentId) {
    const [result] = await db.execute(
        `DELETE FROM employment_history WHERE id = ?`,
        [employmentId]
    );
    return result.affectedRows === 1;
}

// ==================== FULL PROFILE ====================

/**
 * Get complete profile with all sub-sections
 * @param {object} db - Database pool
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} Full profile or null
 */
async function getFullProfile(db, userId) {
    const profile = await getProfileByUserId(db, userId);
    if (!profile) return null;

    const [degrees, certifications, licences, shortCourses, employment] =
        await Promise.all([
            getDegreesByProfileId(db, profile.id),
            getCertificationsByProfileId(db, profile.id),
            getLicencesByProfileId(db, profile.id),
            getShortCoursesByProfileId(db, profile.id),
            getEmploymentByProfileId(db, profile.id),
        ]);

    return {
        ...profile,
        degrees,
        certifications,
        licences,
        shortCourses,
        employment,
    };
}

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
