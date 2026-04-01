// Express framework for creating modular route handlers
const express = require("express");
// Create a new router instance for public API routes
const router = express.Router();

// Database connection pool accessor
const { getDatabase } = require("../lib/database");
// Bearer token authentication middleware for API endpoints
const { requireApiAuth } = require("../middleware/apiAuth");
// In-memory rate limiting factory to prevent API abuse
const { rateLimit } = require("../lib/rate-limit");
// Database query functions for bidding and featured alumni data
const bids = require("../queries/bids");
// Database query functions for profile and sub-section data
const profiles = require("../queries/profiles");

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
        const limit = Math.min(
            parseInt(req.query.limit) || 30,
            100
        );

        // Query featured alumni joined with users table, ordered newest first
        // limit is interpolated directly (not as a prepared statement parameter)
        // because mysql2's execute() has a known bug rejecting integer LIMIT params.
        // Safe to interpolate since limit is already validated as an integer 1–100.
        const [rows] = await db.execute(
            `SELECT fa.featured_date, u.full_name,
                    fa.winning_bid_amount
             FROM featured_alumni fa
             JOIN users u ON fa.user_id = u.id
             ORDER BY fa.featured_date DESC
             LIMIT ${limit}`
        );

        // Return the array of featured alumni records as JSON
        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// Export the router for mounting in app.js
module.exports = router;
