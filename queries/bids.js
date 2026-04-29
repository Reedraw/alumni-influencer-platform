// UUID generator for creating unique record IDs across all bidding tables
const { v4: uuidv4 } = require("uuid");

// ==================== BIDDING CYCLES ====================

/**
 * Get today's bidding cycle, or create one if it doesn't exist yet.
 * Each day has exactly one bidding cycle. This function is idempotent —
 * calling it multiple times on the same day returns the same cycle.
 * The cycle starts with 'open' status and is closed by the cron job at 6 PM.
 * @param {object} db - MySQL connection pool
 * @returns {Promise<object>} The bidding cycle record for today
 */
async function getOrCreateTodayCycle(db) {
    // Get today's date in YYYY-MM-DD format for the cycle_date column
    const today = new Date().toISOString().split("T")[0];

    // Check if a cycle already exists for today
    const [existing] = await db.execute(
        `SELECT * FROM bidding_cycles WHERE cycle_date = ? LIMIT 1`,
        [today]
    );

    // If a cycle exists, return it immediately (most common path)
    if (existing[0]) return existing[0];

    // No cycle for today — create a new one with 'open' status
    const id = uuidv4();
    await db.execute(
        `INSERT INTO bidding_cycles (id, cycle_date, status)
         VALUES (?, ?, 'open')`,
        [id, today]
    );

    // Fetch and return the newly created cycle record
    const [rows] = await db.execute(
        `SELECT * FROM bidding_cycles WHERE id = ? LIMIT 1`,
        [id]
    );
    return rows[0];
}

/**
 * Get a bidding cycle by its date.
 * Used by the cron job to find today's cycle for winner selection.
 * @param {object} db - MySQL connection pool
 * @param {string} date - Date string in YYYY-MM-DD format
 * @returns {Promise<object|null>} The cycle record or null if no cycle exists for that date
 */
async function getCycleByDate(db, date) {
    const [rows] = await db.execute(
        `SELECT * FROM bidding_cycles WHERE cycle_date = ? LIMIT 1`,
        [date]
    );
    return rows[0] || null;
}

/**
 * Close a bidding cycle by setting its status to 'closed'.
 * Called by the daily cron job at 6 PM — no more bids can be placed after this.
 * @param {object} db - MySQL connection pool
 * @param {string} cycleId - UUID of the cycle to close
 */
async function closeCycle(db, cycleId) {
    await db.execute(
        `UPDATE bidding_cycles SET status = 'closed' WHERE id = ?`,
        [cycleId]
    );
}

// ==================== BIDS ====================

/**
 * Place a new bid in a bidding cycle.
 * Creates both the bid record and an initial bid revision (revision #1).
 * Bid revisions track the history of amount changes for audit purposes.
 * Each user can only place one bid per cycle (enforced at route level).
 * @param {object} db - MySQL connection pool
 * @param {string} cycleId - UUID of the bidding cycle
 * @param {string} userId - UUID of the user placing the bid
 * @param {number} amount - The bid amount in GBP
 * @returns {Promise<string>} The UUID of the newly created bid
 */
async function placeBid(db, cycleId, userId, amount) {
    const id = uuidv4(); // Unique ID for this bid

    // Insert the bid record with 'active' status
    await db.execute(
        `INSERT INTO bids
            (id, cycle_id, user_id, current_bid_amount, bid_status)
         VALUES (?, ?, ?, ?, 'active')`,
        [id, cycleId, userId, amount]
    );

    // Create the initial bid revision (revision #1) for audit trail
    await db.execute(
        `INSERT INTO bid_revisions
            (id, bid_id, revision_number, bid_amount)
         VALUES (?, ?, 1, ?)`,
        [uuidv4(), id, amount]
    );

    return id;
}

/**
 * Get a user's bid for a specific cycle.
 * Returns null if the user hasn't placed a bid in this cycle.
 * Used to check if user already has a bid (to prevent duplicates)
 * and to display their current bid on the bidding page.
 * @param {object} db - MySQL connection pool
 * @param {string} cycleId - UUID of the bidding cycle
 * @param {string} userId - UUID of the user
 * @returns {Promise<object|null>} The bid record or null if no bid exists
 */
async function getUserBidForCycle(db, cycleId, userId) {
    const [rows] = await db.execute(
        `SELECT * FROM bids
         WHERE cycle_id = ? AND user_id = ?
         LIMIT 1`,
        [cycleId, userId]
    );
    return rows[0] || null;
}

/**
 * Update a bid amount (increase only — decrease validation happens in the route).
 * Creates a new bid revision to track the change history.
 * The revision number auto-increments based on existing revisions for this bid.
 * @param {object} db - MySQL connection pool
 * @param {string} bidId - UUID of the bid to update
 * @param {number} newAmount - The new (higher) bid amount
 */
async function updateBidAmount(db, bidId, newAmount) {
    // Get the current highest revision number for this bid
    const [revisions] = await db.execute(
        `SELECT MAX(revision_number) as max_rev
         FROM bid_revisions WHERE bid_id = ?`,
        [bidId]
    );
    // Calculate the next revision number (starts at 1, increments from there)
    const nextRev = (revisions[0]?.max_rev || 0) + 1;

    // Update the current bid amount on the main bid record
    await db.execute(
        `UPDATE bids SET current_bid_amount = ? WHERE id = ?`,
        [newAmount, bidId]
    );

    // Create a new revision record to track this change for audit purposes
    await db.execute(
        `INSERT INTO bid_revisions
            (id, bid_id, revision_number, bid_amount)
         VALUES (?, ?, ?, ?)`,
        [uuidv4(), bidId, nextRev, newAmount]
    );
}

/**
 * Get a user's bid status with a winning/losing indicator (blind bidding system).
 * The user can see whether they are currently winning or losing, but the actual
 * highest bid amount is NOT revealed — this implements the blind bidding requirement.
 * @param {object} db - MySQL connection pool
 * @param {string} cycleId - UUID of the bidding cycle
 * @param {string} userId - UUID of the user
 * @returns {Promise<object|null>} Bid object with is_winning flag, or null if no bid
 */
async function getUserBidStatus(db, cycleId, userId) {
    // Get the user's bid for this cycle
    const bid = await getUserBidForCycle(db, cycleId, userId);
    if (!bid) return null; // User hasn't placed a bid

    // Get the highest bid amount in this cycle (without revealing who placed it)
    const [rows] = await db.execute(
        `SELECT MAX(current_bid_amount) as highest_bid
         FROM bids WHERE cycle_id = ?`,
        [cycleId]
    );

    const highestBid = rows[0]?.highest_bid || 0;

    // Return the bid with a boolean flag indicating if this is the leading bid
    return {
        ...bid,
        is_winning: parseFloat(bid.current_bid_amount) >= highestBid,
    };
}

/**
 * Get the highest bid for a cycle (used by the automated winner selection cron job).
 * Returns the full bid record of the highest bidder, ordered by amount descending.
 * @param {object} db - MySQL connection pool
 * @param {string} cycleId - UUID of the bidding cycle
 * @returns {Promise<object|null>} The highest bid record, or null if no bids were placed
 */
async function getHighestBidForCycle(db, cycleId) {
    const [rows] = await db.execute(
        `SELECT * FROM bids
         WHERE cycle_id = ?
         ORDER BY current_bid_amount DESC, created_at ASC
         LIMIT 1`,
        [cycleId]
    );
    return rows[0] || null;
}

/**
 * Get all bids for a cycle with user details (used for winner notification emails).
 * Joins with the users table to get each bidder's name and email address.
 * Results are ordered by bid amount descending (highest first).
 * @param {object} db - MySQL connection pool
 * @param {string} cycleId - UUID of the bidding cycle
 * @returns {Promise<Array>} Array of bid records with user full_name and email
 */
async function getAllBidsForCycle(db, cycleId) {
    const [rows] = await db.execute(
        `SELECT b.*, u.full_name, u.email
         FROM bids b
         JOIN users u ON b.user_id = u.id
         WHERE b.cycle_id = ?
         ORDER BY b.current_bid_amount DESC`,
        [cycleId]
    );
    return rows;
}

// ==================== MONTHLY LIMITS ====================

/**
 * Count how many times a user has been featured as Alumni of the Day this month.
 * Used to enforce the monthly feature limit (3 normally, 4 with event attendance).
 * @param {object} db - MySQL connection pool
 * @param {string} userId - UUID of the user
 * @returns {Promise<number>} Number of times featured this month (0 if never)
 */
async function getMonthlyWinCount(db, userId) {
    const [rows] = await db.execute(
        `SELECT COUNT(*) as win_count
         FROM featured_alumni
         WHERE user_id = ?
           AND MONTH(featured_date) = MONTH(CURRENT_DATE())
           AND YEAR(featured_date) = YEAR(CURRENT_DATE())`,
        [userId]
    );
    return rows[0]?.win_count || 0;
}

/**
 * Check if a user attended an alumni event this calendar month.
 * Event attendance grants a bonus feature slot (4 instead of 3 per month).
 * Checks both that the user has an attendance record AND that attended = TRUE.
 * @param {object} db - MySQL connection pool
 * @param {string} userId - UUID of the user
 * @returns {Promise<boolean>} True if the user attended at least one event this month
 */
async function hasAttendedEventThisMonth(db, userId) {
    const [rows] = await db.execute(
        `SELECT COUNT(*) as count
         FROM alumni_event_attendance aea
         JOIN alumni_events ae ON aea.event_id = ae.id
         WHERE aea.user_id = ?
           AND aea.attended = TRUE
           AND MONTH(ae.event_date) = MONTH(CURRENT_DATE())
           AND YEAR(ae.event_date) = YEAR(CURRENT_DATE())`,
        [userId]
    );
    return (rows[0]?.count || 0) > 0; // True if at least one event attended
}

/**
 * Get the monthly feature limit for a user.
 * Base limit is 3 features per month. If the user attended an alumni event
 * this month, they get a bonus slot (4 total). This incentivises event participation.
 * @param {object} db - MySQL connection pool
 * @param {string} userId - UUID of the user
 * @returns {Promise<number>} 3 (base limit) or 4 (with event attendance bonus)
 */
async function getMonthlyLimit(db, userId) {
    const attended = await hasAttendedEventThisMonth(db, userId);
    return attended ? 4 : 3; // Bonus slot for event attendance
}

/**
 * Check if a user is eligible to place a bid (hasn't reached their monthly limit).
 * Compares their current win count against their personalised monthly limit.
 * @param {object} db - MySQL connection pool
 * @param {string} userId - UUID of the user
 * @returns {Promise<boolean>} True if the user can still bid this month
 */
async function canUserBid(db, userId) {
    const winCount = await getMonthlyWinCount(db, userId);
    const limit = await getMonthlyLimit(db, userId);
    return winCount < limit; // True if they haven't used all their slots
}

// ==================== FEATURED ALUMNI ====================

/**
 * Create a featured alumni record (the winner of a bidding cycle).
 * This record determines who is displayed as "Alumni of the Day" on the
 * specified featured_date. Created by the daily cron job after selecting the winner.
 * @param {object} db - MySQL connection pool
 * @param {object} data - Featured alumni data
 * @param {string} data.cycleId - UUID of the bidding cycle this win came from
 * @param {string} data.userId - UUID of the winning user
 * @param {string} data.bidId - UUID of the winning bid
 * @param {string} data.featuredDate - Date when the user will be featured (YYYY-MM-DD)
 * @param {number} data.winningBidAmount - The amount of the winning bid
 * @returns {Promise<string>} The UUID of the newly created featured alumni record
 */
async function createFeaturedAlumni(db, {
    cycleId,
    userId,
    bidId,
    featuredDate,
    winningBidAmount,
}) {
    const id = uuidv4(); // Unique ID for this featured alumni record
    // Insert the featured alumni record using parameterised query
    await db.execute(
        `INSERT INTO featured_alumni
            (id, cycle_id, user_id, bid_id,
             featured_date, winning_bid_amount)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, cycleId, userId, bidId, featuredDate, winningBidAmount]
    );
    return id;
}

/**
 * Get today's featured alumni with their profile data.
 * Joins with users and alumni_profiles tables to get the full display data
 * needed for the "Alumni of the Day" section. Used by the API endpoint.
 * @param {object} db - MySQL connection pool
 * @returns {Promise<object|null>} Featured alumni with profile data, or null if none today
 */
async function getTodayFeaturedAlumni(db) {
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split("T")[0];
    const [rows] = await db.execute(
        // Join with users for name/email and alumni_profiles for bio/image
        `SELECT fa.*, u.full_name, u.email,
                ap.biography, ap.linkedin_url, ap.profile_image_path
         FROM featured_alumni fa
         JOIN users u ON fa.user_id = u.id
         LEFT JOIN alumni_profiles ap ON ap.user_id = fa.user_id
         WHERE fa.featured_date = ?
         LIMIT 1`,
        [today]
    );
    return rows[0] || null; // Null if no one is featured today
}

/**
 * Get a paginated list of past featured alumni, newest first.
 * Used by the history endpoint to show which alumni have been featured
 * and what winning bid amount secured their spot.
 * @param {object} db - MySQL connection pool
 * @param {number} limit - Maximum number of records to return (1–100)
 * @returns {Promise<Array>} Array of { featured_date, full_name, winning_bid_amount }
 */
async function getFeaturedAlumniHistory(db, limit) {
    // limit is validated as an integer 1–100 at the route level before calling here.
    // Interpolated directly because mysql2's execute() rejects integer LIMIT params.
    const [rows] = await db.execute(
        `SELECT fa.featured_date, u.full_name, fa.winning_bid_amount
         FROM featured_alumni fa
         JOIN users u ON fa.user_id = u.id
         ORDER BY fa.featured_date DESC
         LIMIT ${limit}`
    );
    return rows;
}

/**
 * Get a user's complete bid history across all bidding cycles.
 * Joins with bidding_cycles to show the date and status of each cycle.
 * Used to display the bid history table on the user's bidding page.
 * @param {object} db - MySQL connection pool
 * @param {string} userId - UUID of the user
 * @returns {Promise<Array>} Array of bid records with cycle date and status, newest first
 */
async function getUserBidHistory(db, userId) {
    const [rows] = await db.execute(
        `SELECT b.*, bc.cycle_date, bc.status as cycle_status
         FROM bids b
         JOIN bidding_cycles bc ON b.cycle_id = bc.id
         WHERE b.user_id = ?
         ORDER BY bc.cycle_date DESC`,
        [userId]
    );
    return rows;
}

/**
 * Mark a bid as the winner of its cycle.
 * Sets is_winner to TRUE and bid_status to 'won'.
 * Called by the daily cron job after determining the highest bidder.
 * @param {object} db - MySQL connection pool
 * @param {string} bidId - UUID of the winning bid
 */
async function markBidAsWinner(db, bidId) {
    await db.execute(
        `UPDATE bids SET is_winner = TRUE, bid_status = 'won'
         WHERE id = ?`,
        [bidId]
    );
}

/**
 * Mark all other bids in a cycle as losing (everyone except the winner).
 * Sets bid_status to 'lost' for all bids that are NOT the winner's bid.
 * Called by the daily cron job after the winner has been selected.
 * @param {object} db - MySQL connection pool
 * @param {string} cycleId - UUID of the bidding cycle
 * @param {string} winnerBidId - UUID of the winning bid (excluded from update)
 */
async function markOtherBidsAsLosing(db, cycleId, winnerBidId) {
    await db.execute(
        `UPDATE bids SET bid_status = 'lost'
         WHERE cycle_id = ? AND id != ?`,
        [cycleId, winnerBidId]
    );
}

// Export all bidding-related query functions
module.exports = {
    getOrCreateTodayCycle,
    getCycleByDate,
    closeCycle,
    placeBid,
    getUserBidForCycle,
    updateBidAmount,
    getUserBidStatus,
    getHighestBidForCycle,
    getAllBidsForCycle,
    getMonthlyWinCount,
    hasAttendedEventThisMonth,
    getMonthlyLimit,
    canUserBid,
    createFeaturedAlumni,
    getTodayFeaturedAlumni,
    getFeaturedAlumniHistory,
    getUserBidHistory,
    markBidAsWinner,
    markOtherBidsAsLosing,
};
