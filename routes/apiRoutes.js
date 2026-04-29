// Express framework for creating modular route handlers
const express = require("express");
// Create a new router instance for public API routes
const router = express.Router();

// Database connection pool accessor
const { getDatabase } = require("../lib/database");
// Bearer token authentication middleware for API endpoints
const { requireApiAuth, requirePermission } = require("../middleware/apiAuth");
// In-memory rate limiting factory to prevent API abuse
const { rateLimit } = require("../lib/rate-limit");
// Database query functions for bidding and featured alumni data
const bids = require("../queries/bids");
// Database query functions for profile and sub-section data
const profiles = require("../queries/profiles");
// Analytics aggregate query functions for the university dashboard
const analytics = require("../queries/analytics");

// Apply rate limiting: max 100 requests per 15-minute window per IP
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
router.use(apiLimiter);

// Apply Bearer token authentication to ALL API routes
router.use(requireApiAuth);

/**
 * @swagger
 * /api/featured-alumni:
 *   get:
 *     summary: Get today's Alumni of the Day
 *     description: >
 *       Returns the featured alumni profile for today, including
 *       full profile data (biography, degrees, certifications,
 *       licences, courses, employment history).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Today's featured alumni profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FeaturedAlumni'
 *       404:
 *         description: No featured alumni for today
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - invalid or missing API token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET /api/featured-alumni — Return today's featured alumni with full profile
router.get("/featured-alumni", async (req, res) => {
    try {
        const db = getDatabase();
        // Query for today's featured alumni record (winner of yesterday's cycle)
        const featured = await bids.getTodayFeaturedAlumni(db);

        // Return 404 if no one was featured today (no bids or no winner)
        if (!featured) {
            return res.status(404).json({
                error: "No featured alumni for today",
            });
        }

        // Load the winner's complete profile with all 5 sub-sections
        const fullProfile = await profiles.getFullProfile(
            db, featured.user_id
        );

        // Build the API response object with flattened profile data
        const response = {
            id: featured.id,
            full_name: featured.full_name,
            email: featured.email,
            biography: featured.biography,
            linkedin_url: featured.linkedin_url,
            // Prepend slash to make a relative URL, or null if no image
            profile_image_url: featured.profile_image_path
                ? `/${featured.profile_image_path}`
                : null,
            featured_date: featured.featured_date,
            // Convert decimal string from MySQL to JavaScript number
            winning_bid_amount: parseFloat(
                featured.winning_bid_amount
            ),
            // Include all sub-sections with empty array fallbacks
            degrees: fullProfile?.degrees || [],
            certifications: fullProfile?.certifications || [],
            licences: fullProfile?.licences || [],
            short_courses: fullProfile?.shortCourses || [],
            employment: fullProfile?.employment || [],
        };

        res.json(response);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

/**
 * @swagger
 * /api/featured-alumni/history:
 *   get:
 *     summary: Get featured alumni history
 *     description: >
 *       Returns a list of past featured alumni entries,
 *       ordered by most recent first. Limited to 30 entries.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 100
 *         description: Number of records to return
 *     responses:
 *       200:
 *         description: List of featured alumni
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   featured_date:
 *                     type: string
 *                     format: date
 *                   full_name:
 *                     type: string
 *                   winning_bid_amount:
 *                     type: number
 *       401:
 *         description: Unauthorized
 */
// GET /api/featured-alumni/history — Return paginated list of past featured alumni
router.get("/featured-alumni/history", async (req, res) => {
    try {
        const db = getDatabase();
        // Parse limit from query string, default 30, cap at 100 to prevent abuse
        const limit = Math.min(parseInt(req.query.limit) || 30, 100);
        const rows = await bids.getFeaturedAlumniHistory(db, limit);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Export the router for mounting in app.js
module.exports = router;

// ==================== ANALYTICS ENDPOINTS ====================
// All analytics endpoints require read:analytics permission.
// The dashboard API key must be scoped with this permission.

// GET /api/analytics/certifications — Top certifications held by alumni, ranked by frequency
router.get("/analytics/certifications", requirePermission("read:analytics"), async (req, res) => {
    try {
        const db = getDatabase();
        const rows = await analytics.getTopCertifications(db);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/analytics/courses — Most popular short courses completed by alumni
router.get("/analytics/courses", requirePermission("read:analytics"), async (req, res) => {
    try {
        const db = getDatabase();
        const rows = await analytics.getTopShortCourses(db);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/analytics/employment — Current job roles held by alumni (career sectors)
router.get("/analytics/employment", requirePermission("read:analytics"), async (req, res) => {
    try {
        const db = getDatabase();
        const rows = await analytics.getEmploymentSectors(db);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/analytics/degrees — Degree programmes and number of alumni per programme
router.get("/analytics/degrees", requirePermission("read:analytics"), async (req, res) => {
    try {
        const db = getDatabase();
        const rows = await analytics.getDegreeBreakdown(db);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/analytics/bidding — Daily bid counts and averages over the last 60 days
router.get("/analytics/bidding", requirePermission("read:analytics"), async (req, res) => {
    try {
        const db = getDatabase();
        const rows = await analytics.getBiddingTrends(db);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/analytics/alumni — Filterable alumni list with basic profile info
// Query params: programme (degree_name), sector (job_title), graduation_year
router.get("/analytics/alumni", requirePermission("read:analytics"), async (req, res) => {
    try {
        const db = getDatabase();
        const rows = await analytics.getAlumniList(db, req.query);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/analytics/graduation-years — Number of alumni per graduation year
router.get("/analytics/graduation-years", requirePermission("read:analytics"), async (req, res) => {
    try {
        const db = getDatabase();
        const rows = await analytics.getGraduationYearDistribution(db);
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});