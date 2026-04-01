// node-cron library for scheduling recurring tasks with cron syntax
const cron = require("node-cron");
// Database connection pool accessor
const { getDatabase } = require("../lib/database");
// Email utility for sending bid outcome notifications to all bidders
const { sendBidStatusEmail } = require("../lib/email");
// Database query functions for bidding cycles, bids, and featured alumni
const bids = require("../queries/bids");

/**
 * Automated bidding cycle job.
 * Runs daily at 6 PM (18:00) to:
 * 1. Close today's bidding cycle (prevents further bids)
 * 2. Select the highest bidder as the winner
 * 3. Create a featured alumni record for tomorrow's display
 * 4. Notify all participants via email (won/lost status)
 */
function startBiddingCycleJob() {
    // Schedule with cron expression: minute 0, hour 18, every day/month/weekday
    cron.schedule("0 18 * * *", async () => {
        console.log("[BiddingCycle] Running winner selection...");

        try {
            const db = getDatabase();

            // Get today's date in YYYY-MM-DD format for cycle lookup
            const today = new Date().toISOString().split("T")[0];
            // Look up the bidding cycle for today (may not exist if no bids)
            const cycle = await bids.getCycleByDate(db, today);

            // Exit early if no cycle exists for today
            if (!cycle) {
                console.log(
                    "[BiddingCycle] No cycle found for today"
                );
                return;
            }

            // Prevent double-processing if cycle was already closed
            if (cycle.status === "closed") {
                console.log(
                    "[BiddingCycle] Cycle already closed"
                );
                return;
            }

            // Close the cycle — no more bids can be placed after this
            await bids.closeCycle(db, cycle.id);
            console.log("[BiddingCycle] Cycle closed");

            // Find the bid with the highest amount for this cycle
            const winnerBid = await bids.getHighestBidForCycle(
                db, cycle.id
            );

            // Exit if no bids were placed during today's cycle
            if (!winnerBid) {
                console.log(
                    "[BiddingCycle] No bids placed today"
                );
                return;
            }

            // BUSINESS RULE: Check if the highest bidder has exceeded their
            // monthly feature limit (3 base, 4 with event attendance)
            const canWin = await bids.canUserBid(
                db, winnerBid.user_id
            );
            if (!canWin) {
                console.log(
                    "[BiddingCycle] Winner has reached " +
                    "monthly limit, skipping"
                );
                return;
            }

            // Mark the winning bid's status and all other bids as losing
            await bids.markBidAsWinner(db, winnerBid.id);
            await bids.markOtherBidsAsLosing(
                db, cycle.id, winnerBid.id
            );

            // Calculate tomorrow's date — the winner will be featured tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const featuredDate = tomorrow
                .toISOString()
                .split("T")[0];

            // Create the featured alumni record for tomorrow's "Alumni of the Day"
            await bids.createFeaturedAlumni(db, {
                cycleId: cycle.id,
                userId: winnerBid.user_id,
                bidId: winnerBid.id,
                featuredDate,
                winningBidAmount: winnerBid.current_bid_amount,
            });

            // Log the winner details for server monitoring
            console.log(
                `[BiddingCycle] Winner selected: ` +
                `user ${winnerBid.user_id} with bid ` +
                `£${winnerBid.current_bid_amount} ` +
                `for ${featuredDate}`
            );

            // Notify ALL bidders in today's cycle (both winner and losers)
            const allBids = await bids.getAllBidsForCycle(
                db, cycle.id
            );
            for (const bid of allBids) {
                // Determine if this bidder won or lost
                const status =
                    bid.id === winnerBid.id
                        ? "won"
                        : "lost";
                // Send a status email asynchronously (fire-and-forget)
                sendBidStatusEmail(
                    bid.email,
                    status,
                    cycle.cycle_date
                );
            }

            console.log("[BiddingCycle] Notifications sent");
        } catch (error) {
            console.error("[BiddingCycle] Error:", error);
        }
    });

    // Log that the job has been scheduled on server startup
    console.log("Bidding cycle job scheduled (daily at 6 PM)");
}

// Export the function for initialisation in app.js
module.exports = { startBiddingCycleJob };
