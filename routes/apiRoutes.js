const express = require("express");
const router = express.Router();

const { getDatabase } = require("../lib/database");
const { requireApiAuth } = require("../middleware/apiAuth");
const { rateLimit } = require("../lib/rate-limit");
const bids = require("../queries/bids");
const profiles = require("../queries/profiles");

// Rate limiting for API endpoints
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
router.use(apiLimiter);

// All API routes require bearer token authentication
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
router.get("/featured-alumni", async (req, res) => {
    try {
        const db = getDatabase();
        const featured = await bids.getTodayFeaturedAlumni(db);

        if (!featured) {
            return res.status(404).json({
                error: "No featured alumni for today",
            });
        }

        // Get full profile data
        const fullProfile = await profiles.getFullProfile(
            db, featured.user_id
        );

        const response = {
            id: featured.id,
            full_name: featured.full_name,
            email: featured.email,
            biography: featured.biography,
            linkedin_url: featured.linkedin_url,
            profile_image_url: featured.profile_image_path
                ? `/${featured.profile_image_path}`
                : null,
            featured_date: featured.featured_date,
            winning_bid_amount: parseFloat(
                featured.winning_bid_amount
            ),
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
router.get("/featured-alumni/history", async (req, res) => {
    try {
        const db = getDatabase();
        const limit = Math.min(
            parseInt(req.query.limit) || 30,
            100
        );

        const [rows] = await db.execute(
            `SELECT fa.featured_date, u.full_name,
                    fa.winning_bid_amount
             FROM featured_alumni fa
             JOIN users u ON fa.user_id = u.id
             ORDER BY fa.featured_date DESC
             LIMIT ?`,
            [limit]
        );

        res.json(rows);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
