// Express framework for creating modular route handlers
const express = require("express");
// Create a new router instance for bidding-related routes
const router = express.Router();
// express-validator result extractor for checking form validation errors
const { validationResult } = require("express-validator");

// Database connection pool accessor
const { getDatabase } = require("../lib/database");
// Session authentication middleware — redirects to login if not authenticated
const { requireAuth } = require("../middleware/auth");
// CSRF protection middleware to prevent cross-site request forgery
const { csrfProtection } = require("../lib/csrf");
// Email utility for sending bid status notifications to users
const { sendBidStatusEmail } = require("../lib/email");
// Database query functions for bidding cycles, bids, and featured alumni
const bids = require("../queries/bids");
// Validation schemas for place-bid and update-bid forms
const {
    placeBidValidation,
    updateBidValidation,
} = require("../models/bidSchema");

// Apply session authentication to ALL bid routes — must be logged in
router.use(requireAuth);

// ==================== VIEW CURRENT BIDS ====================

// GET /bids — Display today's bidding cycle status and the user's bid history
router.get("/", async (req, res) => {
    try {
        const db = getDatabase();
        // Get or create today's bidding cycle (ensures one exists)
        const cycle = await bids.getOrCreateTodayCycle(db);
        const userId = req.session.user.id;

        // Get the user's bid status for today (blind — only shows own bid info)
        const bidStatus = await bids.getUserBidStatus(
            db, cycle.id, userId
        );
        // Get how many times the user has won this month
        const winCount = await bids.getMonthlyWinCount(db, userId);
        // Get the user's monthly limit (3 base, 4 if attended events)
        const monthlyLimit = await bids.getMonthlyLimit(db, userId);
        // Check if the user is eligible to bid (under monthly limit)
        const canBid = await bids.canUserBid(db, userId);
        // Get the user's historical bid records for display
        const bidHistory = await bids.getUserBidHistory(db, userId);

        // Render the current bids dashboard with all status data
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

// GET /bids/place — Display the bid placement form
router.get("/place", async (req, res) => {
    try {
        const db = getDatabase();
        const cycle = await bids.getOrCreateTodayCycle(db);
        const userId = req.session.user.id;

        // Check if user already has a bid for today's cycle
        const existingBid = await bids.getUserBidForCycle(
            db, cycle.id, userId
        );
        // Check eligibility and monthly stats for the form display
        const canBid = await bids.canUserBid(db, userId);
        const winCount = await bids.getMonthlyWinCount(db, userId);
        const monthlyLimit = await bids.getMonthlyLimit(db, userId);

        // Render the bid placement form with cycle context
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

// POST /bids/place — Handle new bid submission with validation
router.post(
    "/place",
    csrfProtection,
    placeBidValidation, // Validate bid amount (positive number, min £1)
    async (req, res) => {
        try {
            // Check for validation errors from express-validator
            const valErrors = validationResult(req);
            const db = getDatabase();
            const cycle = await bids.getOrCreateTodayCycle(db);
            const userId = req.session.user.id;

            // If validation failed, re-render the form with error messages
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

            // BUSINESS RULE: Reject bids if today's cycle is already closed (after 6 PM)
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

            // BUSINESS RULE: Check if user has exceeded their monthly win limit
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

            // BUSINESS RULE: Only one bid per user per cycle — update instead
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

            // Parse the bid amount from string to float and place the bid
            const amount = parseFloat(req.body.amount);
            await bids.placeBid(db, cycle.id, userId, amount);

            // Send email notification confirming the bid was placed
            sendBidStatusEmail(
                req.session.user.email,
                "Bid placed",
                cycle.cycle_date
            );

            // Redirect to the bids dashboard
            res.redirect("/bids");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// ==================== UPDATE BID (increase only) ====================

// POST /bids/update — Increase an existing bid amount (decrease not allowed)
router.post(
    "/update",
    csrfProtection,
    updateBidValidation, // Validate the new bid amount
    async (req, res) => {
        try {
            const valErrors = validationResult(req);
            const db = getDatabase();
            const cycle = await bids.getOrCreateTodayCycle(db);
            const userId = req.session.user.id;

            // BUSINESS RULE: Cannot update a bid once the cycle is closed
            if (cycle.status !== "open") {
                const winCount = await bids.getMonthlyWinCount(db, userId);
                const monthlyLimit = await bids.getMonthlyLimit(db, userId);
                const canBid = await bids.canUserBid(db, userId);
                const existingBidClosed = await bids.getUserBidForCycle(
                    db, cycle.id, userId
                );
                return res.status(400).render("bids/place-bid", {
                    cycle,
                    existingBid: existingBidClosed,
                    canBid,
                    winCount,
                    monthlyLimit,
                    errors: ["Bidding is closed for today's cycle"],
                });
            }

            // Look up the user's existing bid for today's cycle
            const existingBid = await bids.getUserBidForCycle(
                db, cycle.id, userId
            );

            // If no existing bid found, redirect to the place bid form
            if (!existingBid) {
                return res.redirect("/bids/place");
            }

            // If validation failed, re-render with errors
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

            // BUSINESS RULE: Bids can only be increased, never decreased
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

            // Update the bid amount (also logs revision in bid_revisions table)
            await bids.updateBidAmount(db, existingBid.id, newAmount);

            // Send email notification confirming the bid was updated
            sendBidStatusEmail(
                req.session.user.email,
                "Bid updated",
                cycle.cycle_date
            );

            // Redirect to the bids dashboard
            res.redirect("/bids");
        } catch (error) {
            console.error(error);
            res.status(500).send("Server error");
        }
    }
);

// Export the router for mounting in app.js
module.exports = router;
