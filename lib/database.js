// Load environment variables from .env file
require("dotenv").config();
// MySQL2 with promise support for async/await database operations
const mysql = require("mysql2/promise");

/**
 * Database singleton class.
 * Holds the MySQL connection pool instance to be shared across the application.
 */
class Database {
  constructor() {
    this.pool = null; // Connection pool starts uninitialised
  }
}

// Single instance used throughout the application (singleton pattern)
const db = new Database();

/**
 * Initialise the MySQL connection pool using environment variables.
 * Returns the existing pool if already connected (prevents duplicate pools).
 * @returns {Promise<object>} MySQL connection pool
 */
async function connectToDb() {
  // Return existing pool if already initialised
  if (db.pool) {
    return db.pool;
  }

  // Create a new connection pool with settings from .env
  db.pool = mysql.createPool({
    host: process.env.DB_HOST, // Database server hostname
    port: process.env.DB_PORT, // Database server port (default 3306)
    user: process.env.DB_USER, // Database username
    password: process.env.DB_PASSWORD, // Database password
    database: process.env.DB_NAME, // Database name to connect to
    waitForConnections: true, // Queue requests when all connections are in use
    connectionLimit: 10, // Maximum number of connections in the pool
    queueLimit: 0 // Unlimited queued connection requests (0 = no limit)
  });

  console.log("MySQL connection pool created");

  return db.pool;
}

/**
 * Get the active database connection pool.
 * Throws an error if connectToDb() hasn't been called yet.
 * @returns {object} MySQL connection pool
 */
function getDatabase() {
  if (!db.pool) {
    throw new Error("Database pool not initialized. Call connectToDb()");
  }

  return db.pool;
}

/**
 * Gracefully close all database connections in the pool.
 * Used during server shutdown and in tests.
 */
async function closeDbConnection() {
  if (!db.pool) return; // Nothing to close if pool doesn't exist

  await db.pool.end(); // Close all connections in the pool
  db.pool = null; // Reset so connectToDb() can create a new pool if needed
}

module.exports = {
  connectToDb,
  getDatabase,
  closeDbConnection
};