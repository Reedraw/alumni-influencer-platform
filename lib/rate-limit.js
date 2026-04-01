/**
 * Simple in-memory rate limiter middleware
 * @param {object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 min)
 * @param {number} options.max - Max requests per window (default: 100)
 */
function rateLimit({ windowMs = 15 * 60 * 1000, max = 100 } = {}) {
    const hits = new Map();

    // Cleanup old entries periodically
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (now > entry.resetTime) {
                hits.delete(key);
            }
        }
    }, windowMs);

    return (req, res, next) => {
        const key = req.ip;
        const now = Date.now();

        if (!hits.has(key)) {
            hits.set(key, { count: 1, resetTime: now + windowMs });
            return next();
        }

        const entry = hits.get(key);

        if (now > entry.resetTime) {
            entry.count = 1;
            entry.resetTime = now + windowMs;
            return next();
        }

        entry.count++;

        if (entry.count > max) {
            return res.status(429).json({
                error: "Too many requests, please try again later",
            });
        }

        next();
    };
}

module.exports = { rateLimit };
