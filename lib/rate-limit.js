/**
 * Simple in-memory rate limiter middleware.
 * Tracks request counts per IP address within a sliding time window.
 * Protects against brute-force attacks and API abuse.
 * @param {object} options - Rate limit configuration
 * @param {number} options.windowMs - Time window in milliseconds (default: 15 minutes)
 * @param {number} options.max - Maximum requests allowed per window (default: 100)
 * @returns {Function} Express middleware function
 */
function rateLimit({ windowMs = 15 * 60 * 1000, max = 100 } = {}) {
    // Map to store request counts per IP address: IP -> { count, resetTime }
    const hits = new Map();

    // Periodically clean up expired entries to prevent memory leaks
    setInterval(() => {
        const now = Date.now();
        // Iterate through all tracked IPs and remove expired windows
        for (const [key, entry] of hits) {
            if (now > entry.resetTime) {
                hits.delete(key); // Remove entries whose time window has passed
            }
        }
    }, windowMs); // Run cleanup at the same interval as the window duration

    // Return the Express middleware function
    return (req, res, next) => {
        const key = req.ip; // Use client IP address as the rate limit key
        const now = Date.now();

        // First request from this IP - create a new tracking entry
        if (!hits.has(key)) {
            hits.set(key, { count: 1, resetTime: now + windowMs });
            return next();
        }

        const entry = hits.get(key);

        // Window has expired for this IP - reset the counter
        if (now > entry.resetTime) {
            entry.count = 1;
            entry.resetTime = now + windowMs;
            return next();
        }

        // Increment request count within the current window
        entry.count++;

        // Block the request if the IP has exceeded the maximum allowed requests
        if (entry.count > max) {
            return res.status(429).json({
                error: "Too many requests, please try again later",
            });
        }

        // Request is within the limit - allow it to proceed
        next();
    };
}

module.exports = { rateLimit };
