/**
 * HOSTINGER FIX: Direct MySQL queries instead of Prisma
 * Prisma query engine unstable on shared hosting - use mysql2 directly
 * Zero data loss - same database, just different query driver
 */

const mysql = require('mysql2/promise');

let pool = null;

async function getPool() {
  if (pool) return pool;

  const dbUrl = process.env.DATABASE_URL || '';
  let config = {
    host: 'srv2205.hstgr.io',
    user: 'u825197931_email_user',
    password: 'BoostNow2026',
    database: 'u825197931_email_app',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelaySeconds: 0,
  };
  
  // Try to parse from DATABASE_URL if provided
  if (dbUrl.startsWith('mysql://')) {
    try {
      const url = new URL(dbUrl);
      config.host = url.hostname;
      config.user = url.username;
      config.password = url.password;
      config.database = url.pathname.substring(1);
      config.port = parseInt(url.port) || 3306;
    } catch (parseErr) {
      console.error('⚠️ DATABASE_URL parse failed, using fallback:', parseErr.message);
    }
  }

  console.log('🚀 MySQL connecting to:', config.host);
  
  try {
    pool = await mysql.createPool(config);
    console.log('✅ MySQL pool ready');
    return pool;
  } catch (err) {
    console.error('❌ MySQL pool creation failed:', err.message);
    throw err;
  }
}

// For backward compatibility - return object with common Prisma methods
const prismaProxy = {
  user: {
    findUnique: async ({ where }) => {
      try {
        const pool = await getPool();
        const [rows] = await pool.query(
          'SELECT * FROM users WHERE email = ?',
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
        let query = 'SELECT * FROM users';
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
        await pool.query(`UPDATE users SET ${updates} WHERE id = ?`, values);
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
        await pool.query(`INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders})`, values);
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
          'SELECT * FROM unsubscribe_tokens WHERE token = ?',
          [where.token]
        );
        const token = rows[0];
        if (!token || !include) return token;
        
        // Fetch contact if requested
        if (include.contact) {
          const [contactRows] = await pool.query(
            'SELECT id, email, status FROM contacts WHERE id = ?',
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
          `INSERT INTO unsubscribe_tokens (${keys.join(', ')}) VALUES (${placeholders})`,
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
        await pool.query(`UPDATE unsubscribe_tokens SET ${updates} WHERE token = ?`, values);
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
          'SELECT * FROM contacts WHERE id = ?',
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
        await pool.query(`UPDATE contacts SET ${updates} WHERE id = ?`, values);
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
