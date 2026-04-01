const { v4: uuidv4 } = require("uuid");

// ==================== BIDDING CYCLES ====================

/**
 * Get or create today's bidding cycle
 * @param {object} db - Database pool
 * @returns {Promise<object>} Bidding cycle record
 */
async function getOrCreateTodayCycle(db) {
    const today = new Date().toISOString().split("T")[0];

    const [existing] = await db.execute(
        `SELECT * FROM bidding_cycles WHERE cycle_date = ? LIMIT 1`,
        [today]
    );

    if (existing[0]) return existing[0];

    const id = uuidv4();
    await db.execute(
        `INSERT INTO bidding_cycles (id, cycle_date, status)
         VALUES (?, ?, 'open')`,
        [id, today]
    );

    const [rows] = await db.execute(
        `SELECT * FROM bidding_cycles WHERE id = ? LIMIT 1`,
        [id]
    );
    return rows[0];
}

/**
 * Get bidding cycle by date
 */
async function getCycleByDate(db, date) {
    const [rows] = await db.execute(
        `SELECT * FROM bidding_cycles WHERE cycle_date = ? LIMIT 1`,
        [date]
    );
    return rows[0] || null;
}

/**
 * Close a bidding cycle
 */
async function closeCycle(db, cycleId) {
    await db.execute(
        `UPDATE bidding_cycles SET status = 'closed' WHERE id = ?`,
        [cycleId]
    );
}

// ==================== BIDS ====================

/**
 * Place a new bid in a cycle
 * @param {object} db - Database pool
 * @param {string} cycleId - Bidding cycle ID
 * @param {string} userId - User ID
 * @param {number} amount - Bid amount
 * @returns {Promise<string>} Bid ID
 */
async function placeBid(db, cycleId, userId, amount) {
    const id = uuidv4();

    await db.execute(
        `INSERT INTO bids
            (id, cycle_id, user_id, current_bid_amount, bid_status)
         VALUES (?, ?, ?, ?, 'active')`,
        [id, cycleId, userId, amount]
    );

    // Create initial revision
    await db.execute(
        `INSERT INTO bid_revisions
            (id, bid_id, revision_number, bid_amount)
         VALUES (?, ?, 1, ?)`,
        [uuidv4(), id, amount]
    );

    return id;
}

/**
 * Get user's bid for a specific cycle
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
 * Update bid amount (increase only - validated in route)
 */
async function updateBidAmount(db, bidId, newAmount) {
    // Get current revision count
    const [revisions] = await db.execute(
        `SELECT MAX(revision_number) as max_rev
         FROM bid_revisions WHERE bid_id = ?`,
        [bidId]
    );
    const nextRev = (revisions[0]?.max_rev || 0) + 1;

    await db.execute(
        `UPDATE bids SET current_bid_amount = ? WHERE id = ?`,
        [newAmount, bidId]
    );

    await db.execute(
        `INSERT INTO bid_revisions
            (id, bid_id, revision_number, bid_amount)
         VALUES (?, ?, ?, ?)`,
        [uuidv4(), bidId, nextRev, newAmount]
    );
}

/**
 * Get bid status with winning/losing indicator (blind bidding)
 */
async function getUserBidStatus(db, cycleId, userId) {
    const bid = await getUserBidForCycle(db, cycleId, userId);
    if (!bid) return null;

    // Get highest bid amount for comparison (don't reveal the amount)
    const [rows] = await db.execute(
        `SELECT MAX(current_bid_amount) as highest_bid
         FROM bids WHERE cycle_id = ?`,
        [cycleId]
    );

    const highestBid = rows[0]?.highest_bid || 0;

    return {
        ...bid,
        is_winning: parseFloat(bid.current_bid_amount) >= highestBid,
    };
}

/**
 * Get highest bid for a cycle (used by automated winner selection)
 */
async function getHighestBidForCycle(db, cycleId) {
    const [rows] = await db.execute(
        `SELECT * FROM bids
         WHERE cycle_id = ?
         ORDER BY current_bid_amount DESC
         LIMIT 1`,
        [cycleId]
    );
    return rows[0] || null;
}

/**
 * Get all bids for a cycle (admin use)
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
 * Get how many times user has been featured this month
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
 * Check if user attended an alumni event this month
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
    return (rows[0]?.count || 0) > 0;
}

/**
 * Get monthly feature limit (3 normally, 4 if attended event)
 */
async function getMonthlyLimit(db, userId) {
    const attended = await hasAttendedEventThisMonth(db, userId);
    return attended ? 4 : 3;
}

/**
 * Check if user can still bid (hasn't reached monthly limit)
 */
async function canUserBid(db, userId) {
    const winCount = await getMonthlyWinCount(db, userId);
    const limit = await getMonthlyLimit(db, userId);
    return winCount < limit;
}

// ==================== FEATURED ALUMNI ====================

/**
 * Create featured alumni record (winner)
 */
async function createFeaturedAlumni(db, {
    cycleId,
    userId,
    bidId,
    featuredDate,
    winningBidAmount,
}) {
    const id = uuidv4();
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
 * Get today's featured alumni with full profile data
 */
async function getTodayFeaturedAlumni(db) {
    const today = new Date().toISOString().split("T")[0];
    const [rows] = await db.execute(
        `SELECT fa.*, u.full_name, u.email,
                ap.biography, ap.linkedin_url, ap.profile_image_path
         FROM featured_alumni fa
         JOIN users u ON fa.user_id = u.id
         LEFT JOIN alumni_profiles ap ON ap.user_id = fa.user_id
         WHERE fa.featured_date = ?
         LIMIT 1`,
        [today]
    );
    return rows[0] || null;
}

/**
 * Get user's bid history across all cycles
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
 * Mark a bid as winner
 */
async function markBidAsWinner(db, bidId) {
    await db.execute(
        `UPDATE bids SET is_winner = TRUE, bid_status = 'won'
         WHERE id = ?`,
        [bidId]
    );
}

/**
 * Mark all other bids in cycle as losing
 */
async function markOtherBidsAsLosing(db, cycleId, winnerBidId) {
    await db.execute(
        `UPDATE bids SET bid_status = 'lost'
         WHERE cycle_id = ? AND id != ?`,
        [cycleId, winnerBidId]
    );
}

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
    getUserBidHistory,
    markBidAsWinner,
    markOtherBidsAsLosing,
};
