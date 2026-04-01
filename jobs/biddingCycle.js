// node-cron library for scheduling recurring tasks with cron syntax
const cron = require("node-cron");
// Database connection pool accessor
const { getDatabase } = require("../lib/database");
// Email utility for sending bid outcome notifications to all bidders
const { sendBidStatusEmail } = require("../lib/email");
// Database query functions for bidding cycles, bids, and featured alumni
const bids = require("../queries/bids");

/**
 * Core bidding cycle logic — selects a winner for the given date.
 * Extracted from the cron callback so it can be called directly for testing.
 * @param {string} [dateOverride] - YYYY-MM-DD date to run cycle for (defaults to today)
 * @param {string} [featuredDateOverride] - YYYY-MM-DD date to feature the winner on (defaults to tomorrow)
 * @returns {Promise<{status: string, winner?: object}>} Result summary
 */
async function runBiddingCycle(dateOverride, featuredDateOverride) {
    const db = getDatabase();

    // Use provided date or today in YYYY-MM-DD format
    const cycleDate = dateOverride ||
        new Date().toISOString().split("T")[0];

    // Look up the bidding cycle for the given date
    const cycle = await bids.getCycleByDate(db, cycleDate);

    if (!cycle) {
        console.log("[BiddingCycle] No cycle found for", cycleDate);
        return { status: "no_cycle" };
    }

    // Prevent double-processing if the cycle was already closed
    if (cycle.status === "closed") {
        console.log("[BiddingCycle] Cycle already closed");
        return { status: "already_closed" };
    }

    // Close the cycle — no more bids can be placed after this
    await bids.closeCycle(db, cycle.id);
    console.log("[BiddingCycle] Cycle closed");

    // Find the bid with the highest amount for this cycle
    const winnerBid = await bids.getHighestBidForCycle(db, cycle.id);

    if (!winnerBid) {
        console.log("[BiddingCycle] No bids placed today");
        return { status: "no_bids" };
    }

    // BUSINESS RULE: Check if the highest bidder has exceeded their
    // monthly feature limit (3 base, 4 with event attendance)
    const canWin = await bids.canUserBid(db, winnerBid.user_id);
    if (!canWin) {
        console.log(
            "[BiddingCycle] Winner has reached monthly limit, skipping"
        );
        return { status: "limit_reached" };
    }

    // Mark the winning bid's status and all other bids as losing
    await bids.markBidAsWinner(db, winnerBid.id);
    await bids.markOtherBidsAsLosing(db, cycle.id, winnerBid.id);

    // The winner is featured on the next calendar day (or a provided override date)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const featuredDate = featuredDateOverride || tomorrow.toISOString().split("T")[0];

    // Create the featured alumni record for tomorrow's "Alumni of the Day"
    await bids.createFeaturedAlumni(db, {
        cycleId: cycle.id,
        userId: winnerBid.user_id,
        bidId: winnerBid.id,
        featuredDate,
        winningBidAmount: winnerBid.current_bid_amount,
    });

    console.log(
        `[BiddingCycle] Winner selected: user ${winnerBid.user_id}` +
        ` with bid £${winnerBid.current_bid_amount} for ${featuredDate}`
    );

    // Notify ALL bidders in the cycle (both winner and losers)
    const allBids = await bids.getAllBidsForCycle(db, cycle.id);
    for (const bid of allBids) {
        const status = bid.id === winnerBid.id ? "won" : "lost";
        sendBidStatusEmail(bid.email, status, cycle.cycle_date);
    }

    console.log("[BiddingCycle] Notifications sent");
    return { status: "winner_selected", winner: winnerBid };
}

/**
 * Schedules the bidding cycle to run automatically every day at 6 PM.
 */
function startBiddingCycleJob() {
    // Schedule with cron expression: minute 0, hour 18, every day/month/weekday
    cron.schedule("0 18 * * *", async () => {
        console.log("[BiddingCycle] Running winner selection...");
        try {
            await runBiddingCycle();
        } catch (error) {
            console.error("[BiddingCycle] Error:", error);
        }
    });

    // Log that the job has been scheduled on server startup
    console.log("Bidding cycle job scheduled (daily at 6 PM)");
}

// Export both functions — startBiddingCycleJob for production, runBiddingCycle for testing
module.exports = { startBiddingCycleJob, runBiddingCycle };
