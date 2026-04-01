require("dotenv").config();
const mysql = require("mysql2/promise");

class Database {
  constructor() {
    this.pool = null;
  }
}

const db = new Database();

async function connectToDb() {
  if (db.pool) {
    return db.pool;
  }

  db.pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER, 
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME, 
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  console.log("MySQL connection pool created");

  return db.pool;
}

function getDatabase() {
  if (!db.pool) {
    throw new Error("Database pool not initialized. Call connectToDb()");
  }

  return db.pool;
}

async function closeDbConnection() {
  if (!db.pool) return;

  await db.pool.end();
  db.pool = null;
}

module.exports = {
  connectToDb,
  getDatabase,
  closeDbConnection
};