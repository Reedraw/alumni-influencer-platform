// Password hashing and verification utilities using bcrypt.
// Bcrypt is an adaptive hashing algorithm designed for passwords -
// it automatically handles salting and is intentionally slow to resist brute-force attacks.

const bcrypt = require("bcrypt");

// Number of bcrypt salt rounds (12 = 2^12 = 4096 iterations).
// Higher values are more secure but slower. 12 is recommended for production.
const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password using bcrypt.
 * Generates a unique salt and produces a one-way hash for secure storage.
 * @param {string} password - Plaintext password from user input
 * @returns {Promise<string>} Bcrypt hash string (includes salt and algorithm info)
 */
async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plaintext password against a stored bcrypt hash.
 * Used during login to verify the user's password without decrypting.
 * @param {string} password - Plaintext password from user input
 * @param {string} hash - Stored bcrypt hash from database
 * @returns {Promise<boolean>} True if password matches the hash
 */
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

module.exports = {
    hashPassword,
    verifyPassword
};