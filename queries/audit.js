// UUID generator for creating unique audit log record IDs
const { v4: uuidv4 } = require("uuid");

/**
 * Log an authentication action for the security audit trail.
 * Records every auth-related event (register, login, password reset, etc.)
 * along with the user's IP address and browser user-agent for security monitoring.
 * @param {object} db - MySQL connection pool
 * @param {object} data - Audit log entry data
 * @param {string|null} data.userId - UUID of the user (null for failed logins with unknown users)
 * @param {string|null} data.emailAttempted - Email address used in the attempt
 * @param {string} data.action - Action type (e.g. 'register', 'login_success', 'login_failed')
 * @param {string|null} data.ipAddress - Client IP address
 * @param {string|null} data.userAgent - Client browser user-agent string
 */
async function logAuthAction(db, {
    userId,
    emailAttempted,
    action,
    ipAddress,
    userAgent,
}) {
    const id = uuidv4(); // Generate a unique ID for this audit log entry
    // Insert the audit record using parameterised query to prevent SQL injection
    await db.execute(
        `INSERT INTO auth_audit_logs
            (id, user_id, email_attempted, action, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            id,
            userId || null, // Null if user not identified (e.g. wrong email login)
            emailAttempted || null, // The email address used in the attempt
            action, // The type of auth action being logged
            ipAddress || null, // Client IP for security tracking
            userAgent || null, // Browser info for security tracking
        ]
    );
}

module.exports = { logAuthAction };
