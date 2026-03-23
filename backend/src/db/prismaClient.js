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

  const dbUrl = process.env.DATABASE_URL || '';
  let config = {};
  
  if (dbUrl.startsWith('mysql://')) {
    // Parse mysql://user:password@host:port/database?params
    const url = new URL(dbUrl);
    config = {
      host: url.hostname,
      user: url.username,
      password: url.password,
      database: url.pathname.substring(1),
      port: parseInt(url.port) || 3306,
    };
    
    // Extract connection pool params from URL query string
    if (url.searchParams.has('connectionLimit')) {
      config.connectionLimit = parseInt(url.searchParams.get('connectionLimit'));
    }
    if (url.searchParams.has('waitForConnections')) {
      config.waitForConnections = url.searchParams.get('waitForConnections') === 'true';
    }
    if (url.searchParams.has('enableKeepAlive')) {
      config.enableKeepAlive = url.searchParams.get('enableKeepAlive') === 'true';
    }
    if (url.searchParams.has('keepAliveInitialDelaySeconds')) {
      config.keepAliveInitialDelaySeconds = parseInt(url.searchParams.get('keepAliveInitialDelaySeconds'));
    }
  } else {
    // Use individual env vars (fallback for Hostinger)
    config = {
      host: process.env.DB_HOST || 'srv2205.hstgr.io',
      user: process.env.DB_USER || 'u825197931_email_user',
      password: process.env.DB_PASS || 'BoostNow2026',
      database: process.env.DB_NAME || 'u825197931_email_app',
      port: process.env.DB_PORT || 3306,
    };
  }

  // Set defaults if not provided
  if (!config.connectionLimit) config.connectionLimit = 5;
  if (config.waitForConnections === undefined) config.waitForConnections = true;
  if (config.enableKeepAlive === undefined) config.enableKeepAlive = true;
  if (!config.keepAliveInitialDelaySeconds) config.keepAliveInitialDelaySeconds = 0;
  
  config.queueLimit = 0;
  
  console.log('🚀 MySQL pool config:', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    connectionLimit: config.connectionLimit
  });
  
  try {
    pool = await mysql.createPool(config);
    console.log('🚀 MySQL pool created');
    
    // Test connection
    const conn = await pool.getConnection();
    await conn.query('SELECT 1');
    conn.release();
    console.log('✅ MySQL connection verified');
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('MySQL error code:', err.code);
    console.error('MySQL error errno:', err.errno);
    pool = null;
    throw err;
  }
  
  return pool;
}

// For backward compatibility - return object with common Prisma methods
const prismaProxy = {
  user: {
    findUnique: async ({ where }) => {
      try {
        const pool = await getPool();
        const [rows] = await pool.query(
          'SELECT id, email, password, firstName, lastName, role, isActive FROM User WHERE email = ?',
          [where.email]
        );
        return rows[0] || null;
      } catch (err) {
        console.error('❌ User.findUnique error:', err.message);
        throw err;
      }
    },
    findMany: async ({ where = {}, skip = 0, take = 10 }) => {
      try {
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
      } catch (err) {
        console.error('❌ User.findMany error:', err.message);
        throw err;
      }
    },
    update: async ({ where, data }) => {
      try {
        const pool = await getPool();
        const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = Object.values(data);
        values.push(where.id);
        await pool.query(`UPDATE User SET ${updates} WHERE id = ?`, values);
        return { id: where.id, ...data };
      } catch (err) {
        console.error('❌ User.update error:', err.message);
        throw err;
      }
    },
    create: async ({ data }) => {
      try {
        const pool = await getPool();
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(', ');
        await pool.query(`INSERT INTO User (${keys.join(', ')}) VALUES (${placeholders})`, values);
        return data;
      } catch (err) {
        console.error('❌ User.create error:', err.message);
        throw err;
      }
    },
  },
  unsubscribeToken: {
    findUnique: async ({ where, include }) => {
      try {
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
      } catch (err) {
        console.error('❌ UnsubscribeToken.findUnique error:', err.message);
        throw err;
      }
    },
    create: async ({ data }) => {
      try {
        const pool = await getPool();
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(', ');
        await pool.query(
          `INSERT INTO UnsubscribeToken (${keys.join(', ')}) VALUES (${placeholders})`,
          values
        );
        return data;
      } catch (err) {
        console.error('❌ UnsubscribeToken.create error:', err.message);
        throw err;
      }
    },
    update: async ({ where, data }) => {
      try {
        const pool = await getPool();
        const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = Object.values(data);
        values.push(where.token);
        await pool.query(`UPDATE UnsubscribeToken SET ${updates} WHERE token = ?`, values);
        return { ...data, token: where.token };
      } catch (err) {
        console.error('❌ UnsubscribeToken.update error:', err.message);
        throw err;
      }
    },
  },
  contact: {
    findUnique: async ({ where }) => {
      try {
        const pool = await getPool();
        const [rows] = await pool.query(
          'SELECT * FROM Contact WHERE id = ?',
          [where.id]
        );
        return rows[0] || null;
      } catch (err) {
        console.error('❌ Contact.findUnique error:', err.message);
        throw err;
      }
    },
    update: async ({ where, data }) => {
      try {
        const pool = await getPool();
        const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = Object.values(data);
        values.push(where.id);
        await pool.query(`UPDATE Contact SET ${updates} WHERE id = ?`, values);
        return { id: where.id, ...data };
      } catch (err) {
        console.error('❌ Contact.update error:', err.message);
        throw err;
      }
    },
  },
  $disconnect: async () => {
    try {
      if (pool) {
        await pool.end();
        pool = null;
        console.log('✅ Database pool closed');
      }
    } catch (err) {
      console.error('❌ Error closing pool:', err.message);
    }
  }
};

process.on('beforeExit', async () => {
  try {
    await prismaProxy.$disconnect();
  } catch (e) {
    console.error('Error during beforeExit:', e.message);
  }
});
process.on('SIGINT', async () => {
  try {
    await prismaProxy.$disconnect();
  } catch (e) {
    console.error('Error during SIGINT:', e.message);
  }
});
process.on('SIGTERM', async () => {
  try {
    await prismaProxy.$disconnect();
  } catch (e) {
    console.error('Error during SIGTERM:', e.message);
  }
});

module.exports = prismaProxy;
