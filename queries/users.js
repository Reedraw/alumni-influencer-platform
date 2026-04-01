// Import password hashing and verification utilities (bcrypt-based)
const { hashPassword, verifyPassword } = require("../lib/password");

/**
 * Create a new user account in the database.
 * Hashes the plaintext password before storing it.
 * @param {object} db - MySQL connection pool
 * @param {object} data - User registration data
 * @param {string} data.id - UUID for the new user
 * @param {string} data.full_name - User's full name
 * @param {string} data.email - User's email address
 * @param {string} data.password - Plaintext password (will be hashed)
 * @param {boolean} data.is_verified - Whether email is verified (default: false)
 * @param {boolean} data.is_active - Whether account is active (default: true)
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
    // Hash the plaintext password using bcrypt before database storage
    const passwordHash = await hashPassword(password);

    // Parameterised query to prevent SQL injection
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

    // Execute the insert with parameterised values
    await db.execute(query, [
        id,
        full_name,
        email,
        passwordHash, // Store the hashed password, never the plaintext
        is_verified,
        is_active
    ]);
}


/**
 * Look up a user by their email address.
 * Used during login and duplicate email checking during registration.
 * @param {object} db - MySQL connection pool
 * @param {string} email - Email address to search for
 * @returns {Promise<object|null>} User record or null if not found
 */
async function getUserByEmail(db, email) {
    const [rows] = await db.execute(
        `SELECT * FROM users WHERE email = ? LIMIT 1`,
        [email] // Parameterised to prevent SQL injection
    );

    return rows[0] || null; // Return the user object or null
}


/**
 * Look up a user by their UUID.
 * Used for session-based lookups after authentication.
 * @param {object} db - MySQL connection pool
 * @param {string} userId - User UUID
 * @returns {Promise<object|null>} User record or null if not found
 */
async function getUserById(db, userId) {
    const [rows] = await db.execute(
        `SELECT * FROM users WHERE id = ? LIMIT 1`,
        [userId]
    );

    return rows[0] || null;
}


/**
 * Mark a user's email as verified after they click the verification link.
 * Updates the is_verified flag and the updated_at timestamp.
 * @param {object} db - MySQL connection pool
 * @param {string} userId - User UUID to verify
 * @returns {Promise<boolean>} True if the update was successful
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

    // Check that exactly one row was affected (the user was found and updated)
    return result.affectedRows === 1;
}


/**
 * Retrieve only the password hash for a user (used internally by verifyUserPassword).
 * @param {object} db - MySQL connection pool
 * @param {string} userId - User UUID
 * @returns {Promise<string|null>} Bcrypt password hash or null
 */
async function getUserPasswordHash(db, userId) {
    const [rows] = await db.execute(
        `SELECT password_hash FROM users WHERE id = ? LIMIT 1`,
        [userId]
    );

    return rows[0]?.password_hash || null;
}


/**
 * Verify a user's password against their stored bcrypt hash.
 * Used during the login flow to authenticate the user.
 * @param {object} db - MySQL connection pool
 * @param {string} userId - User UUID
 * @param {string} password - Plaintext password from login form
 * @returns {Promise<boolean>} True if the password matches
 */
async function verifyUserPassword(db, userId, password) {
    // Retrieve the stored hash from the database
    const passwordHash = await getUserPasswordHash(db, userId);

    // If no hash found, the user doesn't exist
    if (!passwordHash) {
        return false;
    }

    // Compare the plaintext password against the stored bcrypt hash
    return await verifyPassword(password, passwordHash);
}


/**
 * Update a user's password (used after password reset).
 * Hashes the new plaintext password before storing.
 * @param {object} db - MySQL connection pool
 * @param {string} userId - User UUID
 * @param {string} password - New plaintext password
 * @returns {Promise<boolean>} True if the update was successful
 */
async function updateUserPassword(db, userId, password) {
    // Hash the new password with bcrypt before storing
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
 * Check if an email address is already registered in the system.
 * @param {object} db - MySQL connection pool
 * @param {string} email - Email address to check
 * @returns {Promise<boolean>} True if the email already exists
 */
async function emailExists(db, email) {
    const [rows] = await db.execute(
        `SELECT id FROM users WHERE email = ? LIMIT 1`,
        [email]
    );

    return rows.length > 0; // True if at least one row was returned
}


/**
 * Soft-delete a user by setting is_active to FALSE.
 * The account remains in the database but cannot log in.
 * @param {object} db - MySQL connection pool
 * @param {string} userId - User UUID to deactivate
 * @returns {Promise<boolean>} True if the deactivation was successful
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