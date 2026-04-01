// Password hashing and verification utilities using bcrypt

const bcrypt = require("bcrypt");

const SALT_ROUNDS = 12;

/**
 * Hash password
 */
async function hashPassword(password) {
    return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password
 */
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

module.exports = {
    hashPassword,
    verifyPassword
};