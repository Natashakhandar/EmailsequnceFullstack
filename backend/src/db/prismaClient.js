/**
 * HOSTINGER FIX: Direct MySQL queries instead of Prisma
 * Prisma query engine unstable on shared hosting - use mysql2 directly
 * Zero data loss - same database, just different query driver
 */

const mysql = require('mysql2/promise');
const path = require('path');

// Load env earlier
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

let pool = null;

async function getPool() {
  if (pool) return pool;

  pool = await mysql.createPool({
    host: 'srv2205.hstgr.io',
    user: 'u825197931_email_user',
    password: 'BoostNow2026',
    database: 'u825197931_email_app',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelaySeconds: 5,
  });

  console.log('🚀 MySQL pool ready (bypassing Prisma)');
  return pool;
}

// For backward compatibility - return object with common Prisma methods
const prismaProxy = {
  user: {
    findUnique: async ({ where }) => {
      const pool = await getPool();
      const [rows] = await pool.query(
        'SELECT id, email, password, firstName, lastName, role FROM User WHERE email = ?',
        [where.email]
      );
      return rows[0] || null;
    },
    findMany: async ({ where = {}, skip = 0, take = 10 }) => {
      const pool = await getPool();
      let query = 'SELECT * FROM User';
      const params = [];
      if (where.role) {
        query += ' WHERE role = ?';
        params.push(where.role);
      }
      query += ` LIMIT ${take} OFFSET ${skip}`;
      const [rows] = await pool.query(query, params);
      return rows;
    },
    update: async ({ where, data }) => {
      const pool = await getPool();
      const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
      const values = Object.values(data);
      values.push(where.id);
      await pool.query(`UPDATE User SET ${updates} WHERE id = ?`, values);
      return { id: where.id, ...data };
    },
    create: async ({ data }) => {
      const pool = await getPool();
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map(() => '?').join(', ');
      await pool.query(`INSERT INTO User (${keys.join(', ')}) VALUES (${placeholders})`, values);
      return data;
    },
  },
  unsubscribeToken: {
    findUnique: async ({ where, include }) => {
      const pool = await getPool();
      const [rows] = await pool.query(
        'SELECT * FROM UnsubscribeToken WHERE token = ?',
        [where.token]
      );
      const token = rows[0];
      if (!token || !include) return token;
      
      // Fetch contact if requested
      if (include.contact) {
        const [contactRows] = await pool.query(
          'SELECT id, email, status FROM Contact WHERE id = ?',
          [token.contactId]
        );
        token.contact = contactRows[0] || null;
      }
      return token;
    },
    create: async ({ data }) => {
      const pool = await getPool();
      const keys = Object.keys(data);
      const values = Object.values(data);
      const placeholders = keys.map(() => '?').join(', ');
      await pool.query(
        `INSERT INTO UnsubscribeToken (${keys.join(', ')}) VALUES (${placeholders})`,
        values
      );
      return data;
    },
    update: async ({ where, data }) => {
      const pool = await getPool();
      const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
      const values = Object.values(data);
      values.push(where.token);
      await pool.query(`UPDATE UnsubscribeToken SET ${updates} WHERE token = ?`, values);
      return { ...data, token: where.token };
    },
  },
  contact: {
    findUnique: async ({ where }) => {
      const pool = await getPool();
      const [rows] = await pool.query(
        'SELECT * FROM Contact WHERE id = ?',
        [where.id]
      );
      return rows[0] || null;
    },
    update: async ({ where, data }) => {
      const pool = await getPool();
      const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
      const values = Object.values(data);
      values.push(where.id);
      await pool.query(`UPDATE Contact SET ${updates} WHERE id = ?`, values);
      return { id: where.id, ...data };
    },
  },
  $disconnect: async () => {
    if (pool) {
      await pool.end();
      pool = null;
    }
  }
};

process.on('beforeExit', async () => await prismaProxy.$disconnect());
process.on('SIGINT', async () => await prismaProxy.$disconnect());
process.on('SIGTERM', async () => await prismaProxy.$disconnect());

module.exports = prismaProxy;
