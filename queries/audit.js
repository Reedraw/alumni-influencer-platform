const { v4: uuidv4 } = require("uuid");

/**
 * Log an authentication action for audit trail
 * @param {object} db - Database pool
 * @param {object} data - Audit log data
 */
async function logAuthAction(db, {
    userId,
    emailAttempted,
    action,
    ipAddress,
    userAgent,
}) {
    const id = uuidv4();
    await db.execute(
        `INSERT INTO auth_audit_logs
            (id, user_id, email_attempted, action, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            id,
            userId || null,
            emailAttempted || null,
            action,
            ipAddress || null,
            userAgent || null,
        ]
    );
}

module.exports = { logAuthAction };
