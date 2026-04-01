const cron = require("node-cron");
const { getDatabase } = require("../lib/database");
const { sendBidStatusEmail } = require("../lib/email");
const bids = require("../queries/bids");

/**
 * Automated bidding cycle job.
 * Runs daily at 6 PM (18:00) to:
 * 1. Close today's bidding cycle
 * 2. Select the highest bidder as winner
 * 3. Create featured alumni record for tomorrow
 * 4. Notify participants via email
 */
function startBiddingCycleJob() {
    // Run at 6 PM every day
    cron.schedule("0 18 * * *", async () => {
        console.log("[BiddingCycle] Running winner selection...");

        try {
            const db = getDatabase();

            // Get today's cycle
            const today = new Date().toISOString().split("T")[0];
            const cycle = await bids.getCycleByDate(db, today);

            if (!cycle) {
                console.log(
                    "[BiddingCycle] No cycle found for today"
                );
                return;
            }

            if (cycle.status === "closed") {
                console.log(
                    "[BiddingCycle] Cycle already closed"
                );
                return;
            }

            // Close the cycle
            await bids.closeCycle(db, cycle.id);
            console.log("[BiddingCycle] Cycle closed");

            // Find the highest bid
            const winnerBid = await bids.getHighestBidForCycle(
                db, cycle.id
            );

            if (!winnerBid) {
                console.log(
                    "[BiddingCycle] No bids placed today"
                );
                return;
            }

            // Check monthly limit for winner
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

            // Mark as winner
            await bids.markBidAsWinner(db, winnerBid.id);
            await bids.markOtherBidsAsLosing(
                db, cycle.id, winnerBid.id
            );

            // Calculate tomorrow's date for featuring
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const featuredDate = tomorrow
                .toISOString()
                .split("T")[0];

            // Create featured alumni record
            await bids.createFeaturedAlumni(db, {
                cycleId: cycle.id,
                userId: winnerBid.user_id,
                bidId: winnerBid.id,
                featuredDate,
                winningBidAmount: winnerBid.current_bid_amount,
            });

            console.log(
                `[BiddingCycle] Winner selected: ` +
                `user ${winnerBid.user_id} with bid ` +
                `£${winnerBid.current_bid_amount} ` +
                `for ${featuredDate}`
            );

            // Notify all bidders
            const allBids = await bids.getAllBidsForCycle(
                db, cycle.id
            );
            for (const bid of allBids) {
                const status =
                    bid.id === winnerBid.id
                        ? "won"
                        : "lost";
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

    console.log("Bidding cycle job scheduled (daily at 6 PM)");
}

module.exports = { startBiddingCycleJob };
