const express = require("express");
const router = express.Router();
const { validationResult } = require("express-validator");

const { getDatabase } = require("../lib/database");
const { requireAuth } = require("../middleware/auth");
const { csrfProtection } = require("../lib/csrf");
const { sendBidStatusEmail } = require("../lib/email");
const bids = require("../queries/bids");
const {
    placeBidValidation,
    updateBidValidation,
} = require("../models/bidSchema");

// All bid routes require authentication
router.use(requireAuth);

// ==================== VIEW CURRENT BIDS ====================

router.get("/", async (req, res) => {
    try {
        const db = getDatabase();
        const cycle = await bids.getOrCreateTodayCycle(db);
        const userId = req.session.user.id;

        const bidStatus = await bids.getUserBidStatus(
            db, cycle.id, userId
        );
        const winCount = await bids.getMonthlyWinCount(db, userId);
        const monthlyLimit = await bids.getMonthlyLimit(db, userId);
        const canBid = await bids.canUserBid(db, userId);
        const bidHistory = await bids.getUserBidHistory(db, userId);

        res.render("bids/current-bids", {
            cycle,
            bidStatus,
            winCount,
            monthlyLimit,
            canBid,
            bidHistory,
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

// ==================== PLACE BID ====================

router.get("/place", async (req, res) => {
    try {
        const db = getDatabase();
        const cycle = await bids.getOrCreateTodayCycle(db);
        const userId = req.session.user.id;

        const existingBid = await bids.getUserBidForCycle(
            db, cycle.id, userId
        );
        const canBid = await bids.canUserBid(db, userId);
        const winCount = await bids.getMonthlyWinCount(db, userId);
        const monthlyLimit = await bids.getMonthlyLimit(db, userId);

        res.render("bids/place-bid", {
            cycle,
            existingBid,
            canBid,
            winCount,
            monthlyLimit,
            errors: [],
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
});

router.post(
    "/place",
    csrfProtection,
    placeBidValidation,
    async (req, res) => {
        try {
            const valErrors = validationResult(req);
            const db = getDatabase();
            const cycle = await bids.getOrCreateTodayCycle(db);
            const userId = req.session.user.id;

            if (!valErrors.isEmpty()) {
                const existingBid = await bids.getUserBidForCycle(
                    db, cycle.id, userId
                );
                const canBid = await bids.canUserBid(db, userId);
                const winCount = await bids.getMonthlyWinCount(
                    db, userId
                );
                const monthlyLimit = await bids.getMonthlyLimit(
                    db, userId
                );

                return res.status(400).render("bids/place-bid", {
                    cycle,
                    existingBid,
                    canBid,
                    winCount,
                    monthlyLimit,
                    errors: valErrors.array().map((e) => e.msg),
                });
            }

            // Check cycle is open
            if (cycle.status !== "open") {
                return res.status(400).render("bids/place-bid", {
                    cycle,
                    existingBid: null,
                    canBid: false,
                    winCount: 0,
                    monthlyLimit: 3,
                    errors: [
                        "Bidding is closed for today's cycle",
                    ],
                });
            }

            // Check monthly limit
            const canBid = await bids.canUserBid(db, userId);
            if (!canBid) {
                return res.status(400).render("bids/place-bid", {
                    cycle,
                    existingBid: null,
                    canBid: false,
                    winCount: 0,
                    monthlyLimit: 3,
                    errors: [
                        "You have reached your monthly feature limit",
                    ],
                });
            }

            // Check if already bid
            const existingBid = await bids.getUserBidForCycle(
                db, cycle.id, userId
            );

            if (existingBid) {
                return res.status(400).render("bids/place-bid", {
                    cycle,
                    existingBid,
                    canBid: true,
                    winCount: 0,
                    monthlyLimit: 3,
                    errors: [
                        "You already have a bid for today. " +
                        "Use the update form to increase it.",
                    ],
                });
            }

            const amount = parseFloat(req.body.amount);
            await bids.placeBid(db, cycle.id, userId, amount);

            sendBidStatusEmail(
                req.session.user.email,
                "Bid placed",
                cycle.cycle_date
            );

            res.redirect("/bids");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== UPDATE BID (increase only) ====================

router.post(
    "/update",
    csrfProtection,
    updateBidValidation,
    async (req, res) => {
        try {
            const valErrors = validationResult(req);
            const db = getDatabase();
            const cycle = await bids.getOrCreateTodayCycle(db);
            const userId = req.session.user.id;

            const existingBid = await bids.getUserBidForCycle(
                db, cycle.id, userId
            );

            if (!existingBid) {
                return res.redirect("/bids/place");
            }

            if (!valErrors.isEmpty()) {
                const canBid = await bids.canUserBid(db, userId);
                const winCount = await bids.getMonthlyWinCount(
                    db, userId
                );
                const monthlyLimit = await bids.getMonthlyLimit(
                    db, userId
                );
                return res.status(400).render("bids/place-bid", {
                    cycle,
                    existingBid,
                    canBid,
                    winCount,
                    monthlyLimit,
                    errors: valErrors.array().map((e) => e.msg),
                });
            }

            const newAmount = parseFloat(req.body.amount);
            const currentAmount = parseFloat(
                existingBid.current_bid_amount
            );

            // Increase only
            if (newAmount <= currentAmount) {
                const canBid = await bids.canUserBid(db, userId);
                const winCount = await bids.getMonthlyWinCount(
                    db, userId
                );
                const monthlyLimit = await bids.getMonthlyLimit(
                    db, userId
                );
                return res.status(400).render("bids/place-bid", {
                    cycle,
                    existingBid,
                    canBid,
                    winCount,
                    monthlyLimit,
                    errors: [
                        "New bid must be higher than your " +
                        `current bid (£${currentAmount.toFixed(2)})`,
                    ],
                });
            }

            await bids.updateBidAmount(db, existingBid.id, newAmount);

            sendBidStatusEmail(
                req.session.user.email,
                "Bid updated",
                cycle.cycle_date
            );

            res.redirect("/bids");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

module.exports = router;
