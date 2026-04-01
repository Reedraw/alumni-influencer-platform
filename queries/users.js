const { hashPassword, verifyPassword } = require("../lib/password");

/**
 * Create a new user
 */
async function createUser(
    db,
    {
        id,
        full_name,
        email,
        password,
        is_verified = false,
        is_active = true
    }
) {
    const passwordHash = await hashPassword(password);

    const query = `
        INSERT INTO users (
            id,
            full_name,
            email,
            password_hash,
            is_verified,
            is_active
        )
        VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.execute(query, [
        id,
        full_name,
        email,
        passwordHash,
        is_verified,
        is_active
    ]);
}


/**
 * Get user by email
 */
async function getUserByEmail(db, email) {
    const [rows] = await db.execute(
        `SELECT * FROM users WHERE email = ? LIMIT 1`,
        [email]
    );

    return rows[0] || null;
}


/**
 * Get user by ID
 */
async function getUserById(db, userId) {
    const [rows] = await db.execute(
        `SELECT * FROM users WHERE id = ? LIMIT 1`,
        [userId]
    );

    return rows[0] || null;
}


/**
 * Verify user email
 */
async function verifyUserEmail(db, userId) {
    const [result] = await db.execute(
        `
        UPDATE users
        SET is_verified = TRUE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [userId]
    );

    return result.affectedRows === 1;
}


/**
 * Get user password hash
 */
async function getUserPasswordHash(db, userId) {
    const [rows] = await db.execute(
        `SELECT password_hash FROM users WHERE id = ? LIMIT 1`,
        [userId]
    );

    return rows[0]?.password_hash || null;
}


/**
 * Verify user password
 */
async function verifyUserPassword(db, userId, password) {
    const passwordHash = await getUserPasswordHash(db, userId);

    if (!passwordHash) {
        return false;
    }

    return await verifyPassword(password, passwordHash);
}


/**
 * Update user password
 */
async function updateUserPassword(db, userId, password) {
    const passwordHash = await hashPassword(password);

    const [result] = await db.execute(
        `
        UPDATE users
        SET password_hash = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [passwordHash, userId]
    );

    return result.affectedRows === 1;
}


/**
 * Check if email exists
 */
async function emailExists(db, email) {
    const [rows] = await db.execute(
        `SELECT id FROM users WHERE email = ? LIMIT 1`,
        [email]
    );

    return rows.length > 0;
}


/**
 * Soft delete user
 */
async function deactivateUser(db, userId) {
    const [result] = await db.execute(
        `
        UPDATE users
        SET is_active = FALSE,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
        `,
        [userId]
    );

    return result.affectedRows === 1;
}


module.exports = {
    createUser,
    getUserByEmail,
    getUserById,
    verifyUserEmail,
    getUserPasswordHash,
    verifyUserPassword,
    updateUserPassword,
    emailExists,
    deactivateUser
};