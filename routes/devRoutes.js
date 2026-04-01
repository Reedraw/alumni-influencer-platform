// DEV-ONLY route handlers — never mounted in production
// Provides manual triggers for testing time-sensitive features
const express = require("express");
const { getDatabase } = require("../lib/database");
const { runBiddingCycle } = require("../jobs/biddingCycle");

const router = express.Router();

// POST /dev/run-cycle?date=YYYY-MM-DD — runs the cycle for today (or a specific date)
// When triggered manually, features the winner today so results are immediately visible.
router.post("/run-cycle", async (req, res) => {
    try {
        const date = req.query.date || null;
        const today = new Date().toISOString().split("T")[0];
        const result = await runBiddingCycle(date, today);
        res.json(result);
    } catch (error) {
        console.error("[Dev] Cycle trigger error:", error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE /dev/reset-cycle?date=YYYY-MM-DD — deletes today's cycle and all linked data
// (bids + featured_alumni cascade automatically via FK constraints)
router.delete("/reset-cycle", async (req, res) => {
    try {
        const db = getDatabase();
        const date = req.query.date || new Date().toISOString().split("T")[0];
        const [result] = await db.execute(
            `DELETE FROM bidding_cycles WHERE cycle_date = ?`,
            [date]
        );
        if (result.affectedRows === 0) {
            return res.json({ status: "no_cycle", date });
        }
        res.json({ status: "reset", date });
    } catch (error) {
        console.error("[Dev] Cycle reset error:", error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
