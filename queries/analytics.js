// Analytics query functions for the University Analytics Dashboard.
// All queries aggregate data from the alumni_influencers database and are
// called by the analytics API endpoints in routes/apiRoutes.js.

// ==================== CERTIFICATIONS ====================

/**
 * Get the most common certifications held by verified alumni, ranked by frequency.
 * Used to identify skills gaps — certifications alumni acquire independently
 * that aren't part of the university curriculum.
 * @param {object} db - MySQL connection pool
 * @returns {Promise<Array>} Array of { certification, provider, count } ordered by count desc
 */
async function getTopCertifications(db) {
    const [rows] = await db.execute(
        `SELECT
            pc.certification_name AS certification,
            pc.provider_name      AS provider,
            COUNT(*)              AS count
         FROM profile_certifications pc
         JOIN alumni_profiles ap ON ap.id = pc.profile_id
         JOIN users u ON u.id = ap.user_id
         WHERE u.is_verified = TRUE AND u.is_active = TRUE
         GROUP BY pc.certification_name, pc.provider_name
         ORDER BY count DESC
         LIMIT 20`
    );
    return rows;
}

// ==================== SHORT COURSES ====================

/**
 * Get the most popular short courses completed by verified alumni.
 * Reveals professional development trends — courses alumni independently
 * take to fill gaps in their university education.
 * @param {object} db - MySQL connection pool
 * @returns {Promise<Array>} Array of { course, provider, count } ordered by count desc
 */
async function getTopShortCourses(db) {
    const [rows] = await db.execute(
        `SELECT
            psc.course_name   AS course,
            psc.provider_name AS provider,
            COUNT(*)          AS count
         FROM profile_short_courses psc
         JOIN alumni_profiles ap ON ap.id = psc.profile_id
         JOIN users u ON u.id = ap.user_id
         WHERE u.is_verified = TRUE AND u.is_active = TRUE
         GROUP BY psc.course_name, psc.provider_name
         ORDER BY count DESC
         LIMIT 20`
    );
    return rows;
}

// ==================== EMPLOYMENT SECTORS ====================

/**
 * Get the current job roles/sectors alumni work in.
 * Only counts employment entries marked as current role (is_current_role = TRUE).
 * Used to map career pathways and identify industries graduates enter.
 * @param {object} db - MySQL connection pool
 * @returns {Promise<Array>} Array of { sector, count } ordered by count desc
 */
async function getEmploymentSectors(db) {
    const [rows] = await db.execute(
        `SELECT
            eh.job_title AS sector,
            COUNT(*)     AS count
         FROM employment_history eh
         JOIN alumni_profiles ap ON ap.id = eh.profile_id
         JOIN users u ON u.id = ap.user_id
         WHERE eh.is_current_role = TRUE
           AND u.is_verified = TRUE
           AND u.is_active = TRUE
         GROUP BY eh.job_title
         ORDER BY count DESC
         LIMIT 20`
    );
    return rows;
}

// ==================== DEGREE PROGRAMMES ====================

/**
 * Get all degree programmes and the number of alumni per programme.
 * Used to understand the spread of graduates across programmes and
 * correlate programme choice with career outcomes.
 * @param {object} db - MySQL connection pool
 * @returns {Promise<Array>} Array of { programme, institution, count } ordered by count desc
 */
async function getDegreeBreakdown(db) {
    const [rows] = await db.execute(
        `SELECT
            pd.degree_name             AS programme,
            pd.institution_name        AS institution,
            COUNT(DISTINCT ap.user_id) AS count
         FROM profile_degrees pd
         JOIN alumni_profiles ap ON ap.id = pd.profile_id
         JOIN users u ON u.id = ap.user_id
         WHERE u.is_verified = TRUE AND u.is_active = TRUE
         GROUP BY pd.degree_name, pd.institution_name
         ORDER BY count DESC
         LIMIT 20`
    );
    return rows;
}

// ==================== BIDDING ACTIVITY ====================

/**
 * Get daily bidding activity over the last 60 days.
 * Tracks platform engagement trends — total bids per day,
 * average bid amount, and highest bid.
 * @param {object} db - MySQL connection pool
 * @returns {Promise<Array>} Array of { cycle_date, total_bids, avg_bid, highest_bid }
 */
async function getBiddingTrends(db) {
    const [rows] = await db.execute(
        `SELECT
            bc.cycle_date                          AS cycle_date,
            COUNT(b.id)                            AS total_bids,
            COALESCE(AVG(b.current_bid_amount), 0) AS avg_bid,
            COALESCE(MAX(b.current_bid_amount), 0) AS highest_bid
         FROM bidding_cycles bc
         LEFT JOIN bids b ON b.cycle_id = bc.id
         WHERE bc.cycle_date >= DATE_SUB(CURDATE(), INTERVAL 60 DAY)
         GROUP BY bc.cycle_date
         ORDER BY bc.cycle_date ASC`
    );
    return rows;
}

// ==================== ALUMNI LIST ====================

/**
 * Get a filterable list of alumni with basic profile information.
 * Supports filtering by degree programme, current job title (sector),
 * and graduation year. Used by the Alumni Explorer table in the dashboard.
 * @param {object} db - MySQL connection pool
 * @param {object} filters - Optional filter values
 * @param {string} [filters.programme] - Filter by degree_name
 * @param {string} [filters.sector] - Filter by current job_title
 * @param {number} [filters.graduation_year] - Filter by year of degree completion
 * @returns {Promise<Array>} Array of alumni profile summary objects
 */
async function getAlumniList(db, { programme, sector, graduation_year } = {}) {
    const conditions = [
        "u.is_verified = TRUE",
        "u.is_active = TRUE",
    ];
    const params = [];

    if (programme) {
        conditions.push("pd.degree_name = ?");
        params.push(programme);
    }
    if (graduation_year) {
        const year = parseInt(graduation_year, 10);
        if (!isNaN(year)) {
            conditions.push("YEAR(pd.completion_date) = ?");
            params.push(year);
        }
    }
    if (sector) {
        conditions.push("eh.job_title = ?");
        params.push(sector);
    }

    const whereClause = conditions.join(" AND ");

    const [rows] = await db.execute(
        `SELECT
            u.id,
            u.full_name,
            ap.biography,
            ap.linkedin_url,
            ap.profile_image_path,
            pd.degree_name           AS degree_programme,
            pd.institution_name,
            YEAR(pd.completion_date) AS graduation_year,
            eh.job_title             AS current_position,
            eh.job_title             AS current_sector,
            eh.employer_name         AS current_employer
         FROM users u
         JOIN alumni_profiles ap ON ap.user_id = u.id
         LEFT JOIN profile_degrees pd ON pd.profile_id = ap.id
         LEFT JOIN employment_history eh
             ON eh.profile_id = ap.id AND eh.is_current_role = TRUE
         WHERE ${whereClause}
         GROUP BY u.id, pd.degree_name, pd.institution_name,
                  pd.completion_date, eh.job_title, eh.employer_name
         ORDER BY u.full_name ASC
         LIMIT 200`,
        params
    );
    return rows;
}

module.exports = {
    getTopCertifications,
    getTopShortCourses,
    getEmploymentSectors,
    getDegreeBreakdown,
    getBiddingTrends,
    getAlumniList,
};
