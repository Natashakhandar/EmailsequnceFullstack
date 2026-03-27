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

const COLUMN_MAPPINGS = {
  leadListName: 'lead_list_name',
  unsubscribeReason: 'unsubscribe_reason',
  unsubscribedAt: 'unsubscribed_at'
};

const mapContact = (row) => {
  if (!row) return null;
  const mapped = { ...row };
  if ('lead_list_name' in mapped) {
    mapped.leadListName = mapped.lead_list_name;
    delete mapped.lead_list_name;
  }
  if ('unsubscribe_reason' in mapped) {
    mapped.unsubscribeReason = mapped.unsubscribe_reason;
    delete mapped.unsubscribe_reason;
  }
  if ('unsubscribed_at' in mapped) {
    mapped.unsubscribedAt = mapped.unsubscribed_at;
    delete mapped.unsubscribed_at;
  }
  return mapped;
};

const mapUnsubscribeToken = (row) => {
  if (!row) return null;
  const mapped = { ...row };
  // DB columns are already camelCase for this table, but ensure Dates are correct
  if (mapped.createdAt && typeof mapped.createdAt === 'string') mapped.createdAt = new Date(mapped.createdAt);
  if (mapped.usedAt && typeof mapped.usedAt === 'string') mapped.usedAt = new Date(mapped.usedAt);
  return mapped;
};

// For backward compatibility - return object with common Prisma methods
const prismaProxy = {
  query: async (sql, params) => {
    const pool = await getPool();
    return await pool.query(sql, params);
  },
  user: {
    findUnique: async ({ where, select }) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM users WHERE ';
        let params = [];
        
        if (where.id) {
          query += 'id = ?';
          params.push(where.id);
        } else if (where.email) {
          query += 'email = ?';
          params.push(where.email);
        } else {
          throw new Error('findUnique requires id OR email in where clause');
        }
        
        const [rows] = await pool.query(query, params);
        return rows[0] || null;
      } catch (err) {
        console.error('❌ User.findUnique error:', err.message);
        throw err;
      }
    },
    findMany: async ({ where = {}, skip = 0, take = 100, select, orderBy = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM users';
        const params = [];
        const conditions = [];
        
        if (where.role) {
          conditions.push('role = ?');
          params.push(where.role);
        }
        if (where.managerId) {
          conditions.push('managerId = ?');
          params.push(where.managerId);
        }
        
        if (conditions.length > 0) {
          query += ' WHERE ' + conditions.join(' AND ');
        }
        
        // Handle orderBy
        const orderField = Object.keys(orderBy)[0] || 'createdAt';
        const orderDir = orderBy[orderField] === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${orderField} ${orderDir}`;
        
        query += ` LIMIT ${take} OFFSET ${skip}`;
        const [rows] = await pool.query(query, params);
        
        // Add managedUsers relation for each user
        for (const row of rows) {
          try {
            const [managed] = await pool.query(
              'SELECT id, email, firstName, lastName FROM users WHERE managerId = ?',
              [row.id]
            );
            row.managedUsers = managed || [];
          } catch (e) {
            row.managedUsers = [];
          }
        }
        
        return rows;
      } catch (err) {
        console.error('❌ User.findMany error:', err.message);
        throw err;
      }
    },
    findFirst: async ({ where }) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM users WHERE 1=1';
        const params = [];
        
        if (where.id) {
          query += ' AND id = ?';
          params.push(where.id);
        }
        if (where.managerId) {
          query += ' AND managerId = ?';
          params.push(where.managerId);
        }
        
        const [rows] = await pool.query(query + ' LIMIT 1', params);
        return rows[0] || null;
      } catch (err) {
        console.error('❌ User.findFirst error:', err.message);
        throw err;
      }
    },
    update: async ({ where, data, select }) => {
      try {
        const pool = await getPool();
        
        // Handle managedUsers relation separately
        if (data.managedUsers) {
          if (data.managedUsers.set) {
            // Clear existing managed users
            await pool.query('UPDATE users SET managerId = NULL WHERE managerId = ?', [where.id]);
            // Set new managed users
            for (const u of data.managedUsers.set) {
              await pool.query('UPDATE users SET managerId = ? WHERE id = ?', [where.id, u.id]);
            }
          }
          delete data.managedUsers;
        }
        
        // Don't run UPDATE if no plain fields to update
        if (Object.keys(data).length > 0) {
          const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
          const values = Object.values(data);
          values.push(where.id);
          await pool.query(`UPDATE users SET ${updates} WHERE id = ?`, values);
        }
        
        // Fetch and return the updated user
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [where.id]);
        const user = rows[0] || { id: where.id, ...data };
        
        // Add managedUsers relation
        try {
          const [managed] = await pool.query(
            'SELECT id, email, firstName, lastName FROM users WHERE managerId = ?',
            [user.id]
          );
          user.managedUsers = managed || [];
        } catch (e) {
          user.managedUsers = [];
        }
        
        return user;
      } catch (err) {
        console.error('❌ User.update error:', err.message);
        throw err;
      }
    },
    create: async ({ data }) => {
      try {
        const pool = await getPool();
        const id = require('crypto').randomBytes(12).toString('hex');
        const now = new Date();
        
        const insertData = {
          id,
          email: data.email,
          password: data.password,
          firstName: data.firstName || null,
          lastName: data.lastName || null,
          role: data.role || 'USER',
          isActive: data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
          createdAt: now,
          updatedAt: now
        };
        
        const keys = Object.keys(insertData);
        const values = Object.values(insertData);
        const placeholders = keys.map(() => '?').join(', ');
        await pool.query(`INSERT INTO users (${keys.join(', ')}) VALUES (${placeholders})`, values);
        
        return { ...insertData, id, isActive: true, createdAt: now, updatedAt: now };
      } catch (err) {
        console.error('❌ User.create error:', err.message);
        throw err;
      }
    },
    delete: async ({ where }) => {
      try {
        const pool = await getPool();
        await pool.query('DELETE FROM users WHERE id = ?', [where.id]);
        return { id: where.id };
      } catch (err) {
        console.error('❌ User.delete error:', err.message);
        if (err.message?.includes('not found') || err.code === 'ER_ROW_IS_REFERENCED') {
          const error = new Error('User not found');
          error.code = 'P2025';
          throw error;
        }
        throw err;
      }
    },
  },
  unsubscribeToken: {
    findUnique: async ({ where, include }) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM unsubscribe_tokens WHERE ';
        let params = [];
        
        if (where.token) {
          query += 'token = ?';
          params.push(where.token);
        } else if (where.id) {
          query += 'id = ?';
          params.push(where.id);
        } else {
          return null;
        }

        const [rows] = await pool.query(query, params);
        const token = mapUnsubscribeToken(rows[0]);
        if (!token || !include) return token;
        
        // Fetch contact if requested
        if (include.contact) {
          const [contactRows] = await pool.query(
            'SELECT id, email, status FROM contacts WHERE id = ?',
            [token.contactId]
          );
          token.contact = mapContact(contactRows[0]) || null;
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
        const insertData = {
          id: data.id || require('crypto').randomBytes(8).toString('hex').toUpperCase(),
          token: data.token,
          contactId: data.contactId,
          createdAt: data.createdAt || new Date(),
          usedAt: data.usedAt || null
        };
        const keys = Object.keys(insertData);
        const values = Object.values(insertData);
        const placeholders = keys.map(() => '?').join(', ');
        await pool.query(
          `INSERT INTO unsubscribe_tokens (${keys.join(', ')}) VALUES (${placeholders})`,
          values
        );
        return insertData;
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
        
        let whereClause = '';
        if (where.id) {
          whereClause = 'id = ?';
          values.push(where.id);
        } else if (where.token) {
          whereClause = 'token = ?';
          values.push(where.token);
        } else {
          throw new Error('UnsubscribeToken.update requires id or token in where clause');
        }

        await pool.query(`UPDATE unsubscribe_tokens SET ${updates} WHERE ${whereClause}`, values);
        return { ...data, ...where };
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
        return mapContact(rows[0]);
      } catch (err) {
        console.error('❌ Contact.findUnique error:', err.message);
        throw err;
      }
    },
    findFirst: async ({ where }) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM contacts WHERE 1=1';
        const params = [];
        
        if (where.email && where.userId) {
          query += ' AND email = ? AND userId = ?';
          params.push(where.email, where.userId);
        } else if (where.email) {
          query += ' AND email = ?';
          params.push(where.email);
        } else if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        } else if (where.id) {
          query += ' AND id = ?';
          params.push(where.id);
        }
        
        const [rows] = await pool.query(query + ' LIMIT 1', params);
        return mapContact(rows[0]);
      } catch (err) {
        console.error('❌ Contact.findFirst error:', err.message);
        throw err;
      }
    },
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {}, include = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM contacts WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        if (where.status) {
          query += ' AND status = ?';
          params.push(where.status);
        }
        if (where.email) {
          query += ' AND email = ?';
          params.push(where.email);
        }
        if (where.leadListName !== undefined) {
          if (where.leadListName === null) {
            query += ' AND lead_list_name IS NULL';
          } else {
            query += ' AND lead_list_name = ?';
            params.push(where.leadListName);
          }
        }
        
        // Handle search with OR (email, firstName, lastName, company, leadListName)
        if (where.OR && Array.isArray(where.OR)) {
          let orConditions = [];
          const orParams = [];
          for (const orCondition of where.OR) {
            const key = Object.keys(orCondition)[0];
            const value = orCondition[key];
            const dbKey = key === 'leadListName' ? 'lead_list_name' : key;
            
            if (value && typeof value === 'object') {
              if (value.contains) {
                orConditions.push(`${dbKey} LIKE ?`);
                orParams.push(`%${value.contains}%`);
              } else if (value.startsWith) {
                orConditions.push(`${dbKey} LIKE ?`);
                orParams.push(`${value.startsWith}%`);
              } else if (value.equals) {
                orConditions.push(`${dbKey} = ?`);
                orParams.push(value.equals);
              }
            } else if (value !== undefined) {
              // Direct equality
              orConditions.push(`${dbKey} = ?`);
              orParams.push(value);
            }
            // Case 4: timestamp as string (for events, if this was an event query)
            // This block is for Contact.findMany, so 'timestamp' would not be a direct contact field.
            // Assuming this is a placeholder for a future 'Event' model or a misunderstanding.
            // If it's meant for a related table, it would need a JOIN.
            // For now, I'll add it as if 'timestamp' could be a direct field, but it's unlikely for 'contacts'.
            // If this was for an 'Event' model, 'e.timestamp' would make sense.
            // Given the instruction "Add timestamp string-based search to Event.findMany and Event.count",
            // and the provided snippet being in Contact.findMany, I will interpret it as
            // adding a generic timestamp search if a 'timestamp' field were present in 'contacts'
            // or if 'e' was an alias for 'contacts'.
            // However, the snippet uses `e.timestamp` and `condParams`, which are not defined here.
            // I will adapt it to the current context of `Contact.findMany` and `orParams`.
            if (key === 'timestamp' && value && value.contains) {
              orConditions.push("DATE_FORMAT(timestamp, '%d/%m/%Y %H:%i:%s') LIKE ?");
              orParams.push(`%${value.contains}%`);
            }
          }
          if (orConditions.length > 0) {
            query += ' AND (' + orConditions.join(' OR ') + ')';
            params.push(...orParams);
          }
        }
        
        // Add ordering
        const orderField = Object.keys(orderBy)[0] || 'createdAt';
        const orderDir = orderBy[orderField] === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${orderField} ${orderDir}`;
        
        query += ` LIMIT ${take} OFFSET ${skip}`;
        
        console.log('🔎 Contact.findMany SQL:', query, params);
        
        const [rows] = await pool.query(query, params);
        
        console.log(`✅ Contact.findMany returned ${rows?.length || 0} rows`);
        
        // Handle includes (relationships)
        if (include.enrollments) {
          for (const row of rows) {
            const [enrollments] = await pool.query(
              'SELECT * FROM enrollments WHERE contactId = ?',
              [row.id]
            );
            
            // If include.enrollments.include.sequence is true, fetch sequences
            if (include.enrollments.include && include.enrollments.include.sequence) {
              for (const enrollment of enrollments) {
                const [sequences] = await pool.query(
                  'SELECT * FROM sequences WHERE id = ?',
                  [enrollment.sequenceId]
                );
                enrollment.sequence = sequences[0] || null;
              }
            }
            
            row.enrollments = enrollments;
          }
        }
        
        // Handle _count select (e.g., _count: { select: { events: true } })
        // Note: Only count if explicitly requested
        if (include._count && include._count.select && include._count.select.events) {
          for (const row of rows) {
            row._count = {};
            
            try {
              const [countResult] = await pool.query(
                'SELECT COUNT(*) as count FROM email_activities WHERE contactId = ?',
                [row.id]
              );
              row._count.events = countResult[0]?.count || 0;
            } catch (err) {
              // Table might not exist, set to 0
              row._count.events = 0;
            }
          }
        }
        
        // Map all to camelCase and return
        return (rows || []).map(mapContact);
      } catch (err) {
        console.error('❌ Contact.findMany error:', err.message);
        throw err;
      }
    },
    create: async ({ data }) => {
      try {
        const pool = await getPool();
        const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
        const now = new Date();
        
        // Map camelCase to snake_case
        const dbData = { id, createdAt: now, updatedAt: now };
        for (const [key, value] of Object.entries(data)) {
          const dbKey = COLUMN_MAPPINGS[key] || key;
          dbData[dbKey] = value === undefined ? null : value;
        }
        
        const keys = Object.keys(dbData);
        const values = Object.values(dbData);
        const placeholders = keys.map(() => '?').join(', ');
        
        await pool.query(
          `INSERT INTO contacts (${keys.join(', ')}) VALUES (${placeholders})`,
          values
        );
        
        return { ...data, ...dbData, id };
      } catch (err) {
        console.error('❌ Contact.create error:', err.message);
        throw err;
      }
    },
    update: async ({ where, data }) => {
      try {
        const pool = await getPool();
        
        // Map camelCase to snake_case for columns
        const updateEntries = Object.entries(data).map(([key, value]) => {
          const dbKey = COLUMN_MAPPINGS[key] || key;
          return { dbKey, value };
        });
        
        const updates = updateEntries.map(e => `${e.dbKey} = ?`).join(', ');
        const values = updateEntries.map(e => e.value);
        
        values.push(where.id);
        
        console.log('📝 Contact.update SQL:', `UPDATE contacts SET ${updates} WHERE id = ?`, values);
        
        await pool.query(`UPDATE contacts SET ${updates} WHERE id = ?`, values);
        return { id: where.id, ...data };
      } catch (err) {
        console.error('❌ Contact.update error:', err.message);
        throw err;
      }
    },
    count: async ({ where = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT COUNT(*) as count FROM contacts WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        if (where.status) {
          query += ' AND status = ?';
          params.push(where.status);
        }
        
        const [rows] = await pool.query(query, params);
        return rows[0]?.count || 0;
      } catch (err) {
        console.error('❌ Contact.count error:', err.message);
        throw err;
      }
    },
    groupBy: async ({ by, where = {}, _count = {}, orderBy = {} } = {}) => {
      try {
        const pool = await getPool();
        // Group by status and lead_list_name (database column name)
        const groupField = by.includes('leadListName') || by.includes('lead_list_name') ? 'lead_list_name' : by[0] || 'status';
        let query = `SELECT ${groupField}, status, COUNT(*) as _count FROM contacts WHERE 1=1`;
        const params = [];
        
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        
        query += ` GROUP BY ${groupField}, status`;
        
        const [rows] = await pool.query(query, params);
        return rows.map(row => ({
          // Return with camelCase field name for compatibility
          [groupField === 'lead_list_name' ? 'leadListName' : groupField]: row[groupField],
          status: row.status,
          _count: { _all: row._count }
        }));
      } catch (err) {
        console.error('❌ Contact.groupBy error:', err.message);
        return [];
      }
    },
    deleteMany: async ({ where }) => {
      try {
        const pool = await getPool();
        let query = 'DELETE FROM contacts WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        if (where.id && where.id.in) {
          const placeholders = where.id.in.map(() => '?').join(', ');
          query += ` AND id IN (${placeholders})`;
          params.push(...where.id.in);
        }
        
        await pool.query(query, params);
        return { count: 1 };
      } catch (err) {
        console.error('❌ Contact.deleteMany error:', err.message);
        throw err;
      }
    },
  },
  // Generic query method for raw SQL
  query: async (sql, params = []) => {
    try {
      const pool = await getPool();
      const [rows] = await pool.query(sql, params);
      return rows;
    } catch (err) {
      console.error('❌ Query error:', err.message);
      throw err;
    }
  },
  sequence: {
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {}, include = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM sequences WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        if (where.isActive !== undefined) {
          query += ' AND isActive = ?';
          params.push(where.isActive ? 1 : 0);
        }
        
        const orderField = Object.keys(orderBy)[0] || 'createdAt';
        const orderDir = orderBy[orderField] === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${orderField} ${orderDir} LIMIT ${take} OFFSET ${skip}`;
        
        const [rows] = await pool.query(query, params);
        
        // Handle include.steps with nested template
        if (include.steps) {
          for (const row of rows) {
            let stepsQuery = 'SELECT * FROM sequence_steps WHERE sequenceId = ?';
            let stepsParams = [row.id];
            
            // Apply step ordering
            if (include.steps.orderBy) {
              const stepOrderField = Object.keys(include.steps.orderBy)[0] || 'stepOrder';
              const stepOrderDir = include.steps.orderBy[stepOrderField] === 'asc' ? 'ASC' : 'DESC';
              stepsQuery += ` ORDER BY ${stepOrderField} ${stepOrderDir}`;
            }
            
            const [steps] = await pool.query(stepsQuery, stepsParams);
            
            // If include.steps.include.template is true, fetch template for each step
            if (include.steps.include && include.steps.include.template) {
              for (const step of steps) {
                const [templates] = await pool.query(
                  'SELECT * FROM templates WHERE id = ?',
                  [step.template_id]
                );
                step.template = templates[0] || null;
              }
            }
            
            row.steps = steps;
          }
        }
        
        // Handle _count select
        if (include._count && include._count.select) {
          for (const row of rows) {
            row._count = {};
            
            if (include._count.select.enrollments) {
              const [countResult] = await pool.query(
                'SELECT COUNT(*) as count FROM enrollments WHERE sequenceId = ?',
                [row.id]
              );
              row._count.enrollments = countResult[0]?.count || 0;
            }
            
            if (include._count.select.steps) {
              const [countResult] = await pool.query(
                'SELECT COUNT(*) as count FROM sequence_steps WHERE sequenceId = ?',
                [row.id]
              );
              row._count.steps = countResult[0]?.count || 0;
            }
          }
        }
        
        return rows;
      } catch (err) {
        console.error('❌ Sequence.findMany error:', err.message);
        throw err;
      }
    },
    findFirst: async ({ where, include = {} }) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM sequences WHERE 1=1';
        const params = [];
        
        if (where.id) {
          query += ' AND id = ?';
          params.push(where.id);
        }
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        
        const [rows] = await pool.query(query + ' LIMIT 1', params);
        const row = rows[0] || null;
        
        if (row && include.steps) {
          let stepsQuery = 'SELECT * FROM sequence_steps WHERE sequenceId = ? ORDER BY stepOrder ASC';
          const [steps] = await pool.query(stepsQuery, [row.id]);
          
          if (include.steps === true) {
            row.steps = steps;
          } else if (include.steps.include && include.steps.include.template) {
            for (const step of steps) {
              if (step.templateId || step.template_id) {
                const tplId = step.templateId || step.template_id;
                const [templates] = await pool.query('SELECT * FROM templates WHERE id = ?', [tplId]);
                step.template = templates[0] || null;
              }
            }
            row.steps = steps;
          } else {
            row.steps = steps;
          }
        }
        
        return row;
      } catch (err) {
        console.error('❌ Sequence.findFirst error:', err.message);
        throw err;
      }
    },
    create: async ({ data }) => {
      try {
        const pool = await getPool();
        const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
        const now = new Date();
        
        const insertData = {
          id,
          userId: data.userId,
          name: data.name,
          description: data.description || null,
          isActive: data.isActive ? 1 : 0,
          createdAt: now,
          updatedAt: now
        };
        
        const keys = Object.keys(insertData);
        const values = Object.values(insertData);
        const placeholders = keys.map(() => '?').join(', ');
        
        await pool.query(
          `INSERT INTO sequences (${keys.join(', ')}) VALUES (${placeholders})`,
          values
        );
        
        return { id, ...data, createdAt: now, updatedAt: now };
      } catch (err) {
        console.error('❌ Sequence.create error:', err.message);
        throw err;
      }
    },
    update: async ({ where, data }) => {
      try {
        const pool = await getPool();
        const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = Object.values(data);
        values.push(where.id);
        await pool.query(`UPDATE sequences SET ${updates} WHERE id = ?`, values);
        return { id: where.id, ...data };
      } catch (err) {
        console.error('❌ Sequence.update error:', err.message);
        throw err;
      }
    },
    delete: async ({ where }) => {
      try {
        const pool = await getPool();
        await pool.query('DELETE FROM sequences WHERE id = ?', [where.id]);
        return { id: where.id };
      } catch (err) {
        console.error('❌ Sequence.delete error:', err.message);
        throw err;
      }
    },
    count: async ({ where = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT COUNT(*) as count FROM sequences WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        if (where.isActive !== undefined) {
          query += ' AND isActive = ?';
          params.push(where.isActive ? 1 : 0);
        }
        
        const [rows] = await pool.query(query, params);
        return rows[0]?.count || 0;
      } catch (err) {
        console.error('❌ Sequence.count error:', err.message);
        throw err;
      }
    },
  },
  sequenceStep: {
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM sequence_steps WHERE 1=1';
        const params = [];
        
        if (where.sequence_id || where.sequenceId) {
          query += ' AND sequenceId = ?';
          params.push(where.sequence_id || where.sequenceId);
        }
        
        // Handle camelCase or snake_case field names in orderBy
        let orderField = Object.keys(orderBy)[0];
        if (orderField === 'step_order') orderField = 'stepOrder';
        orderField = orderField || 'stepOrder';
        
        const orderDir = orderBy[Object.keys(orderBy)[0]] === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${orderField} ${orderDir} LIMIT ${take} OFFSET ${skip}`;
        
        const [rows] = await pool.query(query, params);
        return rows || [];
      } catch (err) {
        console.error('❌ SequenceStep.findMany error:', err.message);
        return [];
      }
    },
    create: async ({ data }) => {
      try {
        const pool = await getPool();
        const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
        const now = new Date();
        
        const insertData = {
          id,
          sequenceId: data.sequenceId,
          templateId: data.templateId || null,
          stepOrder: data.stepOrder,
          subject: data.subject || null,
          body: data.body || null,
          delayDays: data.delayDays || 0,
          delayHours: data.delayHours || 0,
          delayMinutes: data.delayMinutes || 0,
          triggerType: data.triggerType || 'delay',
          triggerStepId: data.triggerStepId || null,
          isActive: data.isActive ? 1 : 0,
          createdAt: now,
          updatedAt: now
        };
        
        const keys = Object.keys(insertData);
        const values = Object.values(insertData);
        const placeholders = keys.map(() => '?').join(', ');
        
        await pool.query(
          `INSERT INTO sequence_steps (${keys.join(', ')}) VALUES (${placeholders})`,
          values
        );
        
        return { id, ...data };
      } catch (err) {
        console.error('❌ SequenceStep.create error:', err.message);
        throw err;
      }
    },
    update: async ({ where, data }) => {
      try {
        const pool = await getPool();
        const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const values = Object.values(data);
        values.push(where.id);
        await pool.query(`UPDATE sequence_steps SET ${updates} WHERE id = ?`, values);
        return { id: where.id, ...data };
      } catch (err) {
        console.error('❌ SequenceStep.update error:', err.message);
        throw err;
      }
    },
    delete: async ({ where }) => {
      try {
        const pool = await getPool();
        await pool.query('DELETE FROM sequence_steps WHERE id = ?', [where.id]);
        return { id: where.id };
      } catch (err) {
        console.error('❌ SequenceStep.delete error:', err.message);
        throw err;
      }
    },
    deleteMany: async ({ where }) => {
      try {
        const pool = await getPool();
        let query = 'DELETE FROM sequence_steps WHERE 1=1';
        const params = [];
        
        if (where.sequenceId) {
          query += ' AND sequence_id = ?';
          params.push(where.sequenceId);
        }
        
        await pool.query(query, params);
        return { count: 1 };
      } catch (err) {
        console.error('❌ SequenceStep.deleteMany error:', err.message);
        throw err;
      }
    },
  },
  sequenceTrigger: {
    upsert: async ({ where, create, update }) => {
      try {
        const pool = await getPool();
        const existing = await pool.query(
          'SELECT id FROM sequence_triggers WHERE sequenceId = ?',
          [where.sequenceId]
        );
        
        if (existing[0]?.length > 0) {
          // Update existing
          const updates = Object.keys(update).map(k => `${k} = ?`).join(', ');
          const values = Object.values(update);
          values.push(where.sequenceId);
          await pool.query(
            `UPDATE sequence_triggers SET ${updates} WHERE sequenceId = ?`,
            values
          );
          return { ...update };
        } else {
          // Create new
          const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
          const now = new Date();
          const insertData = { id, ...create, sequenceId: where.sequenceId, createdAt: now, updatedAt: now };
          
          const keys = Object.keys(insertData);
          const vals = Object.values(insertData);
          const placeholders = keys.map(() => '?').join(', ');
          
          await pool.query(
            `INSERT INTO sequence_triggers (${keys.join(', ')}) VALUES (${placeholders})`,
            vals
          );
          
          return { id, ...create };
        }
      } catch (err) {
        console.error('❌ SequenceTrigger.upsert error:', err.message);
        throw err;
      }
    },
    findUnique: async ({ where, include = {} }) => {
      try {
        const pool = await getPool();
        const [rows] = await pool.query(
          'SELECT * FROM sequence_triggers WHERE sequenceId = ?',
          [where.sequenceId]
        );
        const trigger = rows[0] || null;
        
        // Handle include.triggerStep
        if (trigger && include.triggerStep) {
          const [steps] = await pool.query(
            'SELECT * FROM sequence_steps WHERE id = ?',
            [trigger.triggerStepId]
          );
          trigger.triggerStep = steps[0] || null;
        }
        
        return trigger;
      } catch (err) {
        console.error('❌ SequenceTrigger.findUnique error:', err.message);
        throw err;
      }
    },
  },
  enrollment: {
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {}, include = {}, select } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM enrollments WHERE 1=1';
        const params = [];
        
        if (where.sequenceId) {
          query += ' AND sequenceId = ?';
          params.push(where.sequenceId);
        }
        if (where.contactId) {
          if (typeof where.contactId === 'object' && where.contactId.in) {
            const placeholders = where.contactId.in.map(() => '?').join(',');
            query += ` AND contactId IN (${placeholders})`;
            params.push(...where.contactId.in);
          } else {
            query += ' AND contactId = ?';
            params.push(where.contactId);
          }
        }
        if (where.id) {
          if (typeof where.id === 'object' && where.id.in) {
            const placeholders = where.id.in.map(() => '?').join(',');
            query += ` AND id IN (${placeholders})`;
            params.push(...where.id.in);
          } else {
            query += ' AND id = ?';
            params.push(where.id);
          }
        }
        if (where.campaignId) {
          query += ' AND campaignId = ?';
          params.push(where.campaignId);
        }
        if (where.status) {
          query += ' AND status = ?';
          params.push(where.status);
        }
        // Support nextSendAt date filters (critical for scheduler)
        if (where.nextSendAt) {
          if (typeof where.nextSendAt === 'object') {
            if (where.nextSendAt.lte) {
              query += ' AND nextSendAt <= ?';
              params.push(where.nextSendAt.lte);
            }
            if (where.nextSendAt.gte) {
              query += ' AND nextSendAt >= ?';
              params.push(where.nextSendAt.gte);
            }
            if (where.nextSendAt.lt) {
              query += ' AND nextSendAt < ?';
              params.push(where.nextSendAt.lt);
            }
          }
        }
        
        // Handle select (return only specific fields)
        if (select) {
          const fields = Object.keys(select).filter(k => select[k]);
          if (fields.length > 0) {
            query = query.replace('SELECT *', `SELECT ${fields.join(', ')}`);
          }
        }
        
        const orderField = Object.keys(orderBy)[0] || 'createdAt';
        const orderDir = orderBy[orderField] === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${orderField} ${orderDir} LIMIT ${take} OFFSET ${skip}`;
        
        const [rows] = await pool.query(query, params);
        
        // Handle includes (relationships)
        if (include.sequence) {
          for (const row of rows) {
            const [sequences] = await pool.query(
              'SELECT * FROM sequences WHERE id = ?',
              [row.sequenceId]
            );
            row.sequence = sequences[0] || null;
            
            // Handle nested include: sequence.include.steps
            if (row.sequence && include.sequence !== true && include.sequence.include && include.sequence.include.steps) {
              let stepsQuery = 'SELECT * FROM sequence_steps WHERE sequenceId = ?';
              const stepsParams = [row.sequence.id];
              
              // Handle step ordering
              const stepsInclude = include.sequence.include.steps;
              if (stepsInclude.orderBy) {
                const stepOrderField = Object.keys(stepsInclude.orderBy)[0] || 'stepOrder';
                const stepOrderDir = stepsInclude.orderBy[stepOrderField] === 'asc' ? 'ASC' : 'DESC';
                stepsQuery += ` ORDER BY ${stepOrderField} ${stepOrderDir}`;
              } else {
                stepsQuery += ' ORDER BY stepOrder ASC';
              }
              
              const [steps] = await pool.query(stepsQuery, stepsParams);
              
              // Handle step.include.template
              if (stepsInclude.include && stepsInclude.include.template) {
                for (const step of steps) {
                  const tplId = step.templateId || step.template_id;
                  if (tplId) {
                    const [templates] = await pool.query('SELECT * FROM templates WHERE id = ?', [tplId]);
                    step.template = templates[0] || null;
                  }
                }
              }
              
              row.sequence.steps = steps;
            }
          }
        }
        
        if (include.contact) {
          for (const row of rows) {
            const [contacts] = await pool.query(
              'SELECT * FROM contacts WHERE id = ?',
              [row.contactId]
            );
            row.contact = contacts[0] || null;
          }
        }
        
        // Handle events include (critical for scheduler's shouldSendNextEmail)
        if (include.events) {
          for (const row of rows) {
            let eventsQuery = 'SELECT * FROM events WHERE enrollmentId = ?';
            const eventsParams = [row.id];
            
            if (include.events !== true && include.events.orderBy) {
              const eventOrderField = Object.keys(include.events.orderBy)[0] || 'timestamp';
              const eventOrderDir = include.events.orderBy[eventOrderField] === 'asc' ? 'ASC' : 'DESC';
              eventsQuery += ` ORDER BY ${eventOrderField} ${eventOrderDir}`;
            } else {
              eventsQuery += ' ORDER BY timestamp DESC';
            }
            
            const [events] = await pool.query(eventsQuery, eventsParams);
            row.events = events;
          }
        }
        
        return rows;
      } catch (err) {
        console.error('❌ Enrollment.findMany error:', err.message);
        return [];
      }
    },
    count: async ({ where = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT COUNT(*) as count FROM enrollments WHERE 1=1';
        const params = [];
        
        if (where.sequenceId) {
          query += ' AND sequenceId = ?';
          params.push(where.sequenceId);
        }
        if (where.contactId) {
          query += ' AND contactId = ?';
          params.push(where.contactId);
        }
        if (where.status) {
          query += ' AND status = ?';
          params.push(where.status);
        }
        
        const [rows] = await pool.query(query, params);
        return rows[0]?.count || 0;
      } catch (err) {
        console.error('❌ Enrollment.count error:', err.message);
        return 0;
      }
    },
    findUnique: async ({ where, include = {} }) => {
      try {
        const pool = await getPool();
        const [rows] = await pool.query('SELECT * FROM enrollments WHERE id = ?', [where.id]);
        const enrollment = rows[0] || null;
        if (!enrollment) return null;
        
        // Include contact
        if (include.contact) {
          const [contacts] = await pool.query('SELECT * FROM contacts WHERE id = ?', [enrollment.contactId]);
          enrollment.contact = contacts[0] || null;
        }
        
        // Include sequence with nested includes
        if (include.sequence) {
          const [sequences] = await pool.query('SELECT * FROM sequences WHERE id = ?', [enrollment.sequenceId]);
          enrollment.sequence = sequences[0] || null;
          
          if (enrollment.sequence && include.sequence !== true && include.sequence.include) {
            const seqInclude = include.sequence.include;
            
            // Include steps (with optional where filter and template include)
            if (seqInclude.steps) {
              let stepsQuery = 'SELECT * FROM sequence_steps WHERE sequenceId = ?';
              const stepsParams = [enrollment.sequence.id];
              
              // Handle where filter on steps (e.g., { stepOrder: enrollment.currentStep })
              if (seqInclude.steps.where) {
                if (seqInclude.steps.where.stepOrder !== undefined) {
                  stepsQuery += ' AND stepOrder = ?';
                  stepsParams.push(seqInclude.steps.where.stepOrder);
                }
              }
              
              stepsQuery += ' ORDER BY stepOrder ASC';
              const [steps] = await pool.query(stepsQuery, stepsParams);
              
              // Handle template include for each step
              if (seqInclude.steps.include && seqInclude.steps.include.template) {
                for (const step of steps) {
                  const tplId = step.templateId || step.template_id;
                  if (tplId) {
                    const [templates] = await pool.query('SELECT * FROM templates WHERE id = ?', [tplId]);
                    step.template = templates[0] || null;
                  } else {
                    step.template = null;
                  }
                }
              }
              
              enrollment.sequence.steps = steps;
            }
            
            // Include user (sequence owner) with select
            if (seqInclude.user) {
              const [users] = await pool.query('SELECT * FROM users WHERE id = ?', [enrollment.sequence.userId]);
              const user = users[0] || null;
              
              if (user && seqInclude.user.select) {
                // Filter to only selected fields
                const selectedUser = {};
                for (const field of Object.keys(seqInclude.user.select)) {
                  if (seqInclude.user.select[field]) {
                    if (field === 'emailConfig') {
                      // Fetch emailConfig for this user
                      const [configs] = await pool.query('SELECT * FROM email_configs WHERE userId = ? LIMIT 1', [user.id]);
                      selectedUser.emailConfig = configs[0] || null;
                    } else {
                      selectedUser[field] = user[field] !== undefined ? user[field] : null;
                    }
                  }
                }
                enrollment.sequence.user = selectedUser;
              } else {
                enrollment.sequence.user = user;
              }
            }
          }
        }
        
        return enrollment;
      } catch (err) {
        console.error('❌ Enrollment.findUnique error:', err.message);
        throw err;
      }
    },
    create: async ({ data }) => {
      try {
        const pool = await getPool();
        const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
        const now = new Date();
        
        const insertData = {
          id,
          sequenceId: data.sequenceId,
          contactId: data.contactId,
          status: data.status || 'ACTIVE',
          createdAt: now,
          updatedAt: now
        };
        
        const keys = Object.keys(insertData);
        const vals = Object.values(insertData);
        const placeholders = keys.map(() => '?').join(', ');
        
        await pool.query(
          `INSERT INTO enrollments (${keys.join(', ')}) VALUES (${placeholders})`,
          vals
        );
        
        return { id, ...data };
      } catch (err) {
        console.error('❌ Enrollment.create error:', err.message);
        throw err;
      }
    },
    update: async ({ where, data }) => {
      try {
        const pool = await getPool();
        const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const vals = Object.values(data);
        vals.push(where.id);
        await pool.query(`UPDATE enrollments SET ${updates} WHERE id = ?`, vals);
        return { id: where.id, ...data };
      } catch (err) {
        console.error('❌ Enrollment.update error:', err.message);
        throw err;
      }
    },
    updateMany: async ({ where = {}, data }) => {
      try {
        const pool = await getPool();
        const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const vals = [...Object.values(data)];
        let query = `UPDATE enrollments SET ${updates} WHERE 1=1`;
        
        if (where.id) {
          query += ' AND id = ?';
          vals.push(where.id);
        }
        if (where.status) {
          query += ' AND status = ?';
          vals.push(where.status);
        }
        if (where.contactId) {
          if (typeof where.contactId === 'object' && where.contactId.in) {
            const ph = where.contactId.in.map(() => '?').join(',');
            query += ` AND contactId IN (${ph})`;
            vals.push(...where.contactId.in);
          } else {
            query += ' AND contactId = ?';
            vals.push(where.contactId);
          }
        }
        if (where.sequenceId) {
          query += ' AND sequenceId = ?';
          vals.push(where.sequenceId);
        }
        if (where.nextSendAt) {
          if (typeof where.nextSendAt === 'object') {
            if (where.nextSendAt.lte) {
              query += ' AND nextSendAt <= ?';
              vals.push(where.nextSendAt.lte);
            }
          }
        }
        if (where.campaignId) {
          query += ' AND campaignId = ?';
          vals.push(where.campaignId);
        }
        
        const [result] = await pool.query(query, vals);
        return { count: result.affectedRows || 0 };
      } catch (err) {
        console.error('❌ Enrollment.updateMany error:', err.message);
        throw err;
      }
    },
    deleteMany: async ({ where = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'DELETE FROM enrollments WHERE 1=1';
        const params = [];
        
        if (where.contactId) {
          if (typeof where.contactId === 'object' && where.contactId.in) {
            const ph = where.contactId.in.map(() => '?').join(',');
            query += ` AND contactId IN (${ph})`;
            params.push(...where.contactId.in);
          } else {
            query += ' AND contactId = ?';
            params.push(where.contactId);
          }
        }
        if (where.sequenceId) {
          query += ' AND sequenceId = ?';
          params.push(where.sequenceId);
        }
        if (where.id) {
          if (typeof where.id === 'object' && where.id.in) {
            const ph = where.id.in.map(() => '?').join(',');
            query += ` AND id IN (${ph})`;
            params.push(...where.id.in);
          } else {
            query += ' AND id = ?';
            params.push(where.id);
          }
        }
        if (where.campaignId) {
          query += ' AND campaignId = ?';
          params.push(where.campaignId);
        }
        
        const [result] = await pool.query(query, params);
        return { count: result.affectedRows || 0 };
      } catch (err) {
        console.error('❌ Enrollment.deleteMany error:', err.message);
        throw err;
      }
    },
    createMany: async ({ data }) => {
      try {
        const pool = await getPool();
        if (!Array.isArray(data) || data.length === 0) return { count: 0 };
        const now = new Date();
        for (const item of data) {
          const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
          const insertData = {
            id,
            sequenceId: item.sequenceId,
            contactId: item.contactId,
            campaignId: item.campaignId || null,
            status: item.status || 'ACTIVE',
            createdAt: now,
            updatedAt: now
          };
          const keys = Object.keys(insertData);
          const vals = Object.values(insertData);
          const ph = keys.map(() => '?').join(', ');
          await pool.query(`INSERT INTO enrollments (${keys.join(', ')}) VALUES (${ph})`, vals);
        }
        return { count: data.length };
      } catch (err) {
        console.error('❌ Enrollment.createMany error:', err.message);
        throw err;
      }
    },
  },
  emailConfig: {
    findMany: async ({ where = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM email_configs WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        
        const [rows] = await pool.query(query, params);
        return rows || [];
      } catch (err) {
        console.error('❌ EmailConfig.findMany error:', err.message);
        return [];
      }
    },
    findUnique: async ({ where }) => {
      try {
        const pool = await getPool();
        let query, params;
        if (where.userId) {
          query = 'SELECT * FROM email_configs WHERE userId = ? LIMIT 1';
          params = [where.userId];
        } else if (where.id) {
          query = 'SELECT * FROM email_configs WHERE id = ? LIMIT 1';
          params = [where.id];
        } else {
          return null;
        }
        const [rows] = await pool.query(query, params);
        return rows[0] || null;
      } catch (err) {
        console.error('❌ EmailConfig.findUnique error:', err.message);
        return null;
      }
    },
    create: async ({ data }) => {
      try {
        const pool = await getPool();
        const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
        const now = new Date();
        
        await pool.query(
          `INSERT INTO email_configs (id, userId, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword, fromEmail, fromName, imapHost, imapPort, imapTls, imapUser, imapPassword, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            data.userId,
            data.smtpHost || null,
            data.smtpPort || null,
            data.smtpSecure ? 1 : 0,
            data.smtpUser || null,
            data.smtpPassword || null,
            data.fromEmail || null,
            data.fromName || null,
            data.imapHost || null,
            data.imapPort || null,
            data.imapTls ? 1 : 0,
            data.imapUser || null,
            data.imapPassword || null,
            now,
            now
          ]
        );
        
        return { id, ...data };
      } catch (err) {
        console.error('❌ EmailConfig.create error:', err.message);
        throw err;
      }
    },
    upsert: async ({ where, update, create }) => {
      try {
        const pool = await getPool();
        // Check if record exists
        const [existing] = await pool.query('SELECT id FROM email_configs WHERE userId = ? LIMIT 1', [where.userId]);
        
        if (existing && existing.length > 0) {
          // Update
          const setClauses = [];
          const params = [];
          for (const [key, val] of Object.entries(update)) {
            if (key === 'smtpSecure' || key === 'imapTls') {
              setClauses.push(`${key} = ?`);
              params.push(val ? 1 : 0);
            } else {
              setClauses.push(`${key} = ?`);
              params.push(val);
            }
          }
          setClauses.push('updatedAt = NOW()');
          params.push(existing[0].id);
          await pool.query(`UPDATE email_configs SET ${setClauses.join(', ')} WHERE id = ?`, params);
          return { id: existing[0].id, ...update };
        } else {
          // Create
          const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
          const now = new Date();
          const d = create;
          await pool.query(
            `INSERT INTO email_configs (id, userId, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPassword, fromEmail, fromName, imapHost, imapPort, imapTls, imapUser, imapPassword, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [id, d.userId, d.smtpHost||null, d.smtpPort||null, d.smtpSecure?1:0, d.smtpUser||null, d.smtpPassword||null, d.fromEmail||null, d.fromName||null, d.imapHost||null, d.imapPort||null, d.imapTls?1:0, d.imapUser||null, d.imapPassword||null, now, now]
          );
          return { id, ...d };
        }
      } catch (err) {
        console.error('❌ EmailConfig.upsert error:', err.message);
        throw err;
      }
    },
  },
  campaign: {
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {}, include = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM campaigns WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        if (where.status) {
          query += ' AND status = ?';
          params.push(where.status);
        }
        if (where.isActive !== undefined) {
          query += ' AND isActive = ?';
          params.push(where.isActive ? 1 : 0);
        }
        if (where.sequenceId) {
          query += ' AND sequenceId = ?';
          params.push(where.sequenceId);
        }
        
        const orderField = Object.keys(orderBy)[0] || 'createdAt';
        const orderDir = orderBy[orderField] === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${orderField} ${orderDir} LIMIT ${take} OFFSET ${skip}`;
        
        const [rows] = await pool.query(query, params);
        
        // Handle include.sequence
        if (include.sequence) {
          for (const row of rows) {
            const [sequences] = await pool.query(
              'SELECT * FROM sequences WHERE id = ?',
              [row.sequenceId]
            );
            
            if (sequences[0] && include.sequence.select) {
              // Apply select filtering
              const selected = {};
              for (const field of Object.keys(include.sequence.select)) {
                selected[field] = sequences[0][field];
              }
              row.sequence = selected;
            } else {
              row.sequence = sequences[0] || null;
            }
          }
        }
        
        // Handle _count select
        if (include._count && include._count.select) {
          for (const row of rows) {
            row._count = {};
            
            if (include._count.select.campaignLeads) {
              const [countResult] = await pool.query(
                'SELECT COUNT(*) as count FROM campaign_leads WHERE campaignId = ?',
                [row.id]
              );
              row._count.campaignLeads = countResult[0]?.count || 0;
            }
            
            if (include._count.select.enrollments) {
              const [countResult] = await pool.query(
                'SELECT COUNT(*) as count FROM enrollments WHERE campaignId = ?',
                [row.id]
              );
              row._count.enrollments = countResult[0]?.count || 0;
            }
            
            if (include._count.select.events) {
              const [countResult] = await pool.query(
                'SELECT COUNT(*) as count FROM email_activities WHERE campaignId = ?',
                [row.id]
              );
              row._count.events = countResult[0]?.count || 0;
            }
          }
        }
        
        return rows || [];
      } catch (err) {
        console.error('❌ Campaign.findMany error:', err.message);
        return [];
      }
    },
    findFirst: async ({ where }) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM campaigns WHERE 1=1';
        const params = [];
        
        if (where.id) {
          query += ' AND id = ?';
          params.push(where.id);
        }
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        
        const [rows] = await pool.query(query + ' LIMIT 1', params);
        return rows[0] || null;
      } catch (err) {
        console.error('❌ Campaign.findFirst error:', err.message);
        return null;
      }
    },
    count: async ({ where = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT COUNT(*) as count FROM campaigns WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        if (where.isActive !== undefined) {
          query += ' AND isActive = ?';
          params.push(where.isActive ? 1 : 0);
        }
        
        const [rows] = await pool.query(query, params);
        return rows[0]?.count || 0;
      } catch (err) {
        console.error('❌ Campaign.count error:', err.message);
        return 0;
      }
    },
    create: async ({ data }) => {
      try {
        const pool = await getPool();
        const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
        const now = new Date();
        
        const insertData = {
          id,
          userId: data.userId,
          campaignName: data.name || data.campaignName,
          description: data.description || null,
          isActive: data.isActive ? 1 : 0,
          createdAt: now,
          updatedAt: now
        };
        
        const keys = Object.keys(insertData);
        const vals = Object.values(insertData);
        const placeholders = keys.map(() => '?').join(', ');
        
        await pool.query(
          `INSERT INTO campaigns (${keys.join(', ')}) VALUES (${placeholders})`,
          vals
        );
        
        return { id, ...data };
      } catch (err) {
        console.error('❌ Campaign.create error:', err.message);
        throw err;
      }
    },
    update: async ({ where, data }) => {
      try {
        const pool = await getPool();
        const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const vals = Object.values(data);
        vals.push(where.id);
        await pool.query(`UPDATE campaigns SET ${updates} WHERE id = ?`, vals);
        return { id: where.id, ...data };
      } catch (err) {
        console.error('❌ Campaign.update error:', err.message);
        throw err;
      }
    },
    delete: async ({ where }) => {
      try {
        const pool = await getPool();
        await pool.query('DELETE FROM campaigns WHERE id = ?', [where.id]);
        return { id: where.id };
      } catch (err) {
        console.error('❌ Campaign.delete error:', err.message);
        throw err;
      }
    },
  },
  template: {
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {}, include = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM templates WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        
        const orderField = Object.keys(orderBy)[0] || 'createdAt';
        const orderDir = orderBy[orderField] === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${orderField} ${orderDir} LIMIT ${take} OFFSET ${skip}`;
        
        const [rows] = await pool.query(query, params);
        
        // Handle _count select (e.g., _count: { select: { sequenceSteps: true } })
        if (include._count && include._count.select) {
          for (const row of rows) {
            row._count = {};
            
            if (include._count.select.sequenceSteps) {
              const [countResult] = await pool.query(
                'SELECT COUNT(*) as count FROM sequence_steps WHERE templateId = ?',
                [row.id]
              );
              row._count.sequenceSteps = countResult[0]?.count || 0;
            }
          }
        }
        
        return rows || [];
      } catch (err) {
        console.error('❌ Template.findMany error:', err.message);
        return [];
      }
    },
    findFirst: async ({ where }) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM templates WHERE 1=1';
        const params = [];
        
        if (where.id) {
          query += ' AND id = ?';
          params.push(where.id);
        }
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        
        const [rows] = await pool.query(query + ' LIMIT 1', params);
        return rows[0] || null;
      } catch (err) {
        console.error('❌ Template.findFirst error:', err.message);
        return null;
      }
    },
    findUnique: async ({ where }) => {
      try {
        const pool = await getPool();
        const [rows] = await pool.query('SELECT * FROM templates WHERE id = ?', [where.id]);
        return rows[0] || null;
      } catch (err) {
        console.error('❌ Template.findUnique error:', err.message);
        return null;
      }
    },
    count: async ({ where = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT COUNT(*) as count FROM templates WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        
        const [rows] = await pool.query(query, params);
        return rows[0]?.count || 0;
      } catch (err) {
        console.error('❌ Template.count error:', err.message);
        return 0;
      }
    },
    create: async ({ data }) => {
      try {
        const pool = await getPool();
        const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
        const now = new Date();
        
        const insertData = {
          id,
          userId: data.userId,
          name: data.name,
          subject: data.subject || null,
          body: data.body || null,
          isActive: data.isActive ? 1 : 0,
          createdAt: now,
          updatedAt: now
        };
        
        const keys = Object.keys(insertData);
        const vals = Object.values(insertData);
        const placeholders = keys.map(() => '?').join(', ');
        
        await pool.query(
          `INSERT INTO templates (${keys.join(', ')}) VALUES (${placeholders})`,
          vals
        );
        
        return { id, ...data };
      } catch (err) {
        console.error('❌ Template.create error:', err.message);
        throw err;
      }
    },
    update: async ({ where, data }) => {
      try {
        const pool = await getPool();
        const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const vals = Object.values(data);
        vals.push(where.id);
        await pool.query(`UPDATE templates SET ${updates} WHERE id = ?`, vals);
        return { id: where.id, ...data };
      } catch (err) {
        console.error('❌ Template.update error:', err.message);
        throw err;
      }
    },
    delete: async ({ where }) => {
      try {
        const pool = await getPool();
        await pool.query('DELETE FROM templates WHERE id = ?', [where.id]);
        return { id: where.id };
      } catch (err) {
        console.error('❌ Template.delete error:', err.message);
        throw err;
      }
    },
  },
  campaignLead: {
    findMany: async ({ where = {}, skip = 0, take = 100 }) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM campaign_leads WHERE 1=1';
        const params = [];
        
        if (where.campaignId) {
          query += ' AND campaignId = ?';
          params.push(where.campaignId);
        }
        if (where.contactId) {
          query += ' AND contactId = ?';
          params.push(where.contactId);
        }
        
        query += ` LIMIT ${take} OFFSET ${skip}`;
        const [rows] = await pool.query(query, params);
        return rows || [];
      } catch (err) {
        console.error('❌ CampaignLead.findMany error:', err.message);
        return [];
      }
    },
    count: async ({ where = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT COUNT(*) as count FROM campaign_leads WHERE 1=1';
        const params = [];
        
        if (where.campaignId) {
          query += ' AND campaignId = ?';
          params.push(where.campaignId);
        }
        if (where.contactId) {
          query += ' AND contactId = ?';
          params.push(where.contactId);
        }
        
        const [rows] = await pool.query(query, params);
        return rows[0]?.count || 0;
      } catch (err) {
        console.error('❌ CampaignLead.count error:', err.message);
        return 0;
      }
    },
    create: async ({ data }) => {
      try {
        const pool = await getPool();
        const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
        const now = new Date();
        
        const insertData = {
          id,
          campaignId: data.campaignId,
          contactId: data.contactId,
          status: data.status || 'ADDED',
          createdAt: now,
          updatedAt: now
        };
        
        const keys = Object.keys(insertData);
        const vals = Object.values(insertData);
        const placeholders = keys.map(() => '?').join(', ');
        
        await pool.query(
          `INSERT INTO campaign_leads (${keys.join(', ')}) VALUES (${placeholders})`,
          vals
        );
        
        return { id, ...data };
      } catch (err) {
        console.error('❌ CampaignLead.create error:', err.message);
        throw err;
      }
    },
    update: async ({ where, data }) => {
      try {
        const pool = await getPool();
        const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const vals = Object.values(data);
        vals.push(where.id);
        await pool.query(`UPDATE campaign_leads SET ${updates} WHERE id = ?`, vals);
        return { id: where.id, ...data };
      } catch (err) {
        console.error('❌ CampaignLead.update error:', err.message);
        throw err;
      }
    },
    deleteMany: async ({ where = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'DELETE FROM campaign_leads WHERE 1=1';
        const params = [];
        if (where.campaignId) {
          query += ' AND campaignId = ?';
          params.push(where.campaignId);
        }
        if (where.contactId) {
          query += ' AND contactId = ?';
          params.push(where.contactId);
        }
        const [result] = await pool.query(query, params);
        return { count: result.affectedRows || 0 };
      } catch (err) {
        console.error('❌ CampaignLead.deleteMany error:', err.message);
        throw err;
      }
    },
    createMany: async ({ data }) => {
      try {
        const pool = await getPool();
        if (!Array.isArray(data) || data.length === 0) return { count: 0 };
        const now = new Date();
        for (const item of data) {
          const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
          const insertData = {
            id,
            campaignId: item.campaignId,
            contactId: item.contactId,
            status: item.status || 'ADDED',
            createdAt: now,
            updatedAt: now
          };
          const keys = Object.keys(insertData);
          const vals = Object.values(insertData);
          const ph = keys.map(() => '?').join(', ');
          await pool.query(`INSERT INTO campaign_leads (${keys.join(', ')}) VALUES (${ph})`, vals);
        }
        return { count: data.length };
      } catch (err) {
        console.error('❌ CampaignLead.createMany error:', err.message);
        throw err;
      }
    },
  },
  emailActivity: {
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM email_activities WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        if (where.contactId) {
          query += ' AND contactId = ?';
          params.push(where.contactId);
        }
        
        const orderField = Object.keys(orderBy)[0] || 'createdAt';
        const orderDir = orderBy[orderField] === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${orderField} ${orderDir} LIMIT ${take} OFFSET ${skip}`;
        
        const [rows] = await pool.query(query, params);
        return rows || [];
      } catch (err) {
        console.error('❌ EmailActivity.findMany error:', err.message);
        return [];
      }
    },
    count: async ({ where = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT COUNT(*) as count FROM email_activities WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND userId = ?';
          params.push(where.userId);
        }
        if (where.contactId) {
          query += ' AND contactId = ?';
          params.push(where.contactId);
        }
        
        const [rows] = await pool.query(query, params);
        return rows[0]?.count || 0;
      } catch (err) {
        console.error('❌ EmailActivity.count error:', err.message);
        return 0;
      }
    },
    findFirst: async ({ where }) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM email_activities WHERE 1=1';
        const params = [];
        
        if (where.id) {
          query += ' AND id = ?';
          params.push(where.id);
        }
        
        const [rows] = await pool.query(query + ' LIMIT 1', params);
        return rows[0] || null;
      } catch (err) {
        console.error('❌ EmailActivity.findFirst error:', err.message);
        return null;
      }
    },
    create: async ({ data }) => {
      try {
        const pool = await getPool();
        const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
        const now = new Date();
        
        const insertData = {
          id,
          userId: data.userId,
          contactId: data.contactId,
          enrollmentId: data.enrollmentId || null,
          activityType: data.activityType || null,
          subject: data.subject || null,
          body: data.body || null,
          createdAt: now,
          updatedAt: now
        };
        
        const keys = Object.keys(insertData);
        const vals = Object.values(insertData);
        const placeholders = keys.map(() => '?').join(', ');
        
        await pool.query(
          `INSERT INTO email_activities (${keys.join(', ')}) VALUES (${placeholders})`,
          vals
        );
        
        return { id, ...data };
      } catch (err) {
        console.error('❌ EmailActivity.create error:', err.message);
        throw err;
      }
    },
    update: async ({ where, data }) => {
      try {
        const pool = await getPool();
        const updates = Object.keys(data).map(k => `${k} = ?`).join(', ');
        const vals = Object.values(data);
        vals.push(where.id);
        await pool.query(`UPDATE email_activities SET ${updates} WHERE id = ?`, vals);
        return { id: where.id, ...data };
      } catch (err) {
        console.error('❌ EmailActivity.update error:', err.message);
        throw err;
      }
    },
  },
  event: {
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {}, include = {}, select } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT e.* FROM events e';
        const conditions = [];
        const condParams = [];
        
        let joinedContacts = false;
        let joinedEnrollments = false;
        let joinedSequences = false;
        let joinedCampaigns = false;
        let joinedCampaignSequences = false;

        const ensureContactJoin = () => {
          if (!joinedContacts) {
            query += ' JOIN contacts c ON e.contactId = c.id';
            joinedContacts = true;
          }
        };

        const ensureSequenceJoin = () => {
          if (!joinedEnrollments) {
            query += ' LEFT JOIN enrollments en ON e.enrollmentId = en.id';
            joinedEnrollments = true;
          }
          if (!joinedSequences) {
            query += ' LEFT JOIN sequences s ON en.sequenceId = s.id';
            joinedSequences = true;
          }
          if (!joinedCampaigns) {
            query += ' LEFT JOIN campaigns cam ON e.campaignId = cam.id';
            joinedCampaigns = true;
          }
          if (!joinedCampaignSequences) {
            query += ' LEFT JOIN sequences cs ON cam.sequenceId = cs.id';
            joinedCampaignSequences = true;
          }
        };

        // Security / User filtering
        if (where.contact && where.contact.userId) {
          ensureContactJoin();
          conditions.push('c.userId = ?');
          condParams.push(where.contact.userId);
        }

        // Global OR Search
        if (where.OR && Array.isArray(where.OR)) {
          const orConditions = [];
          for (const orMatch of where.OR) {
            if (orMatch.contact && orMatch.contact.OR) {
              ensureContactJoin();
              for (const contactMatch of orMatch.contact.OR) {
                const field = Object.keys(contactMatch)[0];
                const dbField = field === 'leadListName' ? 'lead_list_name' : field;
                orConditions.push(`c.${dbField} LIKE ?`);
                condParams.push(`%${contactMatch[field].contains}%`);
              }
            }
            if (orMatch.enrollment && orMatch.enrollment.sequence && orMatch.enrollment.sequence.name) {
              ensureSequenceJoin();
              orConditions.push(`(s.name LIKE ? OR cs.name LIKE ?)`);
              condParams.push(`%${orMatch.enrollment.sequence.name.contains}%`);
              condParams.push(`%${orMatch.enrollment.sequence.name.contains}%`);
            }
            if (orMatch.details && orMatch.details.contains) {
              orConditions.push(`e.details LIKE ?`);
              condParams.push(`%${orMatch.details.contains}%`);
            }
            if (orMatch.timestamp && orMatch.timestamp.contains) {
              orConditions.push("DATE_FORMAT(e.timestamp, '%d/%m/%Y %H:%i:%s') LIKE ?");
              condParams.push(`%${orMatch.timestamp.contains}%`);
            }
          }
          if (orConditions.length > 0) conditions.push('(' + orConditions.join(' OR ') + ')');
        }
        
        if (where.type) { conditions.push('e.type = ?'); condParams.push(where.type); }
        if (where.contactId && !where.OR) { conditions.push('e.contactId = ?'); condParams.push(where.contactId); }

        query += ' WHERE 1=1';
        if (conditions.length > 0) query += ' AND ' + conditions.join(' AND ');
        
        const orderField = Object.keys(orderBy)[0] || 'timestamp';
        const orderDir = orderBy[orderField] === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY e.${orderField} ${orderDir} LIMIT ${parseInt(take)} OFFSET ${parseInt(skip)}`;
        
        const [rows] = await pool.query(query, condParams);
        
        // Hydrate includes
        for (const row of rows) {
          if (include.contact && row.contactId) {
            const [contacts] = await pool.query('SELECT * FROM contacts WHERE id = ?', [row.contactId]);
            if (contacts[0]) {
              const c = contacts[0];
              if ('lead_list_name' in c) c.leadListName = c.lead_list_name;
              row.contact = c;
            }
          }
          if (include.enrollment && row.enrollmentId) {
            const [enrollments] = await pool.query('SELECT * FROM enrollments WHERE id = ?', [row.enrollmentId]);
            row.enrollment = enrollments[0] || null;
            if (row.enrollment && include.enrollment.include && include.enrollment.include.sequence) {
              const [sequences] = await pool.query('SELECT * FROM sequences WHERE id = ?', [row.enrollment.sequenceId]);
              row.enrollment.sequence = sequences[0] || null;
            }
          }
          if (include.campaign && row.campaignId) {
            const [campaigns] = await pool.query('SELECT * FROM campaigns WHERE id = ?', [row.campaignId]);
            row.campaign = campaigns[0] || null;
            if (row.campaign && include.campaign.include && include.campaign.include.sequence) {
              const [sequences] = await pool.query('SELECT * FROM sequences WHERE id = ?', [row.campaign.sequenceId]);
              row.campaign.sequence = sequences[0] || null;
            }
          }
        }
        
        return rows || [];
      } catch (err) {
        console.error('❌ Event.findMany error:', err.message);
        return [];
      }
    },
    findFirst: async (params = {}) => {
      const results = await prismaProxy.event.findMany({ ...params, take: 1 });
      return results[0] || null;
    },
    count: async ({ where = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'SELECT COUNT(*) as count FROM events e';
        const conditions = [];
        const condParams = [];
        
        let joinedContacts = false;
        let joinedEnrollments = false;
        let joinedSequences = false;
        let joinedCampaigns = false;
        let joinedCampaignSequences = false;

        const ensureContactJoin = () => {
          if (!joinedContacts) {
            query += ' JOIN contacts c ON e.contactId = c.id';
            joinedContacts = true;
          }
        };

        const ensureSequenceJoin = () => {
          if (!joinedEnrollments) {
            query += ' LEFT JOIN enrollments en ON e.enrollmentId = en.id';
            joinedEnrollments = true;
          }
          if (!joinedSequences) {
            query += ' LEFT JOIN sequences s ON en.sequenceId = s.id';
            joinedSequences = true;
          }
          if (!joinedCampaigns) {
            query += ' LEFT JOIN campaigns cam ON e.campaignId = cam.id';
            joinedCampaigns = true;
          }
          if (!joinedCampaignSequences) {
            query += ' LEFT JOIN sequences cs ON cam.sequenceId = cs.id';
            joinedCampaignSequences = true;
          }
        };

        if (where.contact && where.contact.userId) {
          ensureContactJoin();
          conditions.push('c.userId = ?');
          condParams.push(where.contact.userId);
        }

        if (where.OR && Array.isArray(where.OR)) {
          const orConditions = [];
          for (const orMatch of where.OR) {
            if (orMatch.contact && orMatch.contact.OR) {
              ensureContactJoin();
              for (const contactMatch of orMatch.contact.OR) {
                const field = Object.keys(contactMatch)[0];
                const dbField = field === 'leadListName' ? 'lead_list_name' : field;
                orConditions.push(`c.${dbField} LIKE ?`);
                condParams.push(`%${contactMatch[field].contains}%`);
              }
            }
            if (orMatch.enrollment && orMatch.enrollment.sequence && orMatch.enrollment.sequence.name) {
              ensureSequenceJoin();
              orConditions.push(`(s.name LIKE ? OR cs.name LIKE ?)`);
              condParams.push(`%${orMatch.enrollment.sequence.name.contains}%`);
              condParams.push(`%${orMatch.enrollment.sequence.name.contains}%`);
            }
            if (orMatch.details && orMatch.details.contains) {
              orConditions.push(`e.details LIKE ?`);
              condParams.push(`%${orMatch.details.contains}%`);
            }
            if (orMatch.timestamp && orMatch.timestamp.contains) {
              orConditions.push("DATE_FORMAT(e.timestamp, '%d/%m/%Y %H:%i:%s') LIKE ?");
              condParams.push(`%${orMatch.timestamp.contains}%`);
            }
          }
          if (orConditions.length > 0) conditions.push('(' + orConditions.join(' OR ') + ')');
        }
        
        if (where.type) { conditions.push('e.type = ?'); condParams.push(where.type); }

        query += ' WHERE 1=1';
        if (conditions.length > 0) query += ' AND ' + conditions.join(' AND ');
        
        const [rows] = await pool.query(query, condParams);
        return rows[0]?.count || 0;
      } catch (err) {
        console.error('❌ Event.count error:', err.message);
        return 0;
      }
    },
    create: async ({ data, include = {} }) => {
      try {
        const pool = await getPool();
        const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
        const now = new Date();
        
        const insertData = {
          id,
          enrollmentId: data.enrollmentId || null,
          contactId: data.contactId || null,
          campaignId: data.campaignId || null,
          type: data.type,
          details: data.details || null,
          timestamp: data.timestamp || now,
          emailId: data.emailId || null
        };
        
        const keys = Object.keys(insertData);
        const vals = Object.values(insertData);
        const placeholders = keys.map(() => '?').join(', ');
        
        await pool.query(
          `INSERT INTO events (${keys.join(', ')}) VALUES (${placeholders})`,
          vals
        );
        
        const result = { id, ...insertData };
        
        // Handle includes on the created event
        if (include.contact && result.contactId) {
          const [contacts] = await pool.query('SELECT * FROM contacts WHERE id = ?', [result.contactId]);
          if (contacts[0]) {
            const c = contacts[0];
            if ('lead_list_name' in c) {
              c.leadListName = c.lead_list_name;
              delete c.lead_list_name;
            }
            result.contact = c;
          } else {
            result.contact = null;
          }
        }
        if (include.enrollment && result.enrollmentId) {
          const [enrollments] = await pool.query('SELECT * FROM enrollments WHERE id = ?', [result.enrollmentId]);
          result.enrollment = enrollments[0] || null;
          if (result.enrollment && include.enrollment.include && include.enrollment.include.sequence) {
            const [sequences] = await pool.query('SELECT * FROM sequences WHERE id = ?', [result.enrollment.sequenceId]);
            result.enrollment.sequence = sequences[0] || null;
          }
        }
        
        return result;
      } catch (err) {
        console.error('❌ Event.create error:', err.message);
        throw err;
      }
    },
    deleteMany: async ({ where = {} } = {}) => {
      try {
        const pool = await getPool();
        let query = 'DELETE FROM events WHERE 1=1';
        const params = [];
        
        if (where.enrollmentId) {
          if (typeof where.enrollmentId === 'object' && where.enrollmentId.in) {
            const ph = where.enrollmentId.in.map(() => '?').join(',');
            query += ` AND enrollmentId IN (${ph})`;
            params.push(...where.enrollmentId.in);
          } else {
            query += ' AND enrollmentId = ?';
            params.push(where.enrollmentId);
          }
        }
        if (where.contactId) {
          query += ' AND contactId = ?';
          params.push(where.contactId);
        }
        if (where.timestamp) {
          if (where.timestamp.lt) {
            query += ' AND timestamp < ?';
            params.push(where.timestamp.lt);
          }
        }
        if (where.type) {
          if (typeof where.type === 'object' && where.type.in) {
            const ph = where.type.in.map(() => '?').join(',');
            query += ` AND type IN (${ph})`;
            params.push(...where.type.in);
          }
        }
        if (where.campaignId) {
          if (typeof where.campaignId === 'object' && where.campaignId.in) {
            const ph = where.campaignId.in.map(() => '?').join(',');
            query += ` AND campaignId IN (${ph})`;
            params.push(...where.campaignId.in);
          } else {
            query += ' AND campaignId = ?';
            params.push(where.campaignId);
          }
        }
        
        // Failsafe: Prevent table wipe if conditions parsed successfully but were ignored
        if (Object.keys(where).length > 0 && params.length === 0) {
          console.error('❌ Event.deleteMany prevented table wipe due to unmapped where clause:', where);
          throw new Error('Event.deleteMany called with unsupported where clauses. Table wipe prevented.');
        }

        const [result] = await pool.query(query, params);
        return { count: result.affectedRows || 0 };
      } catch (err) {
        console.error('❌ Event.deleteMany error:', err.message);
        throw err;
      }
    },
    delete: async ({ where = {} } = {}) => {
      try {
        const pool = await getPool();
        if (where.id) {
          const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [where.id]);
          await pool.query('DELETE FROM events WHERE id = ?', [where.id]);
          return rows[0] || null;
        }
        return null;
      } catch (err) {
        console.error('❌ Event.delete error:', err.message);
        throw err;
      }
    },
    groupBy: async ({ by = [], where = {}, _count = {} }) => {
      try {
        const pool = await getPool();
        const groupFields = by.join(', ');
        let query = `SELECT ${groupFields}, COUNT(*) as count FROM events e`;
        const params = [];
        const conditions = [];
        
        if (where.contact && where.contact.userId) {
          query += ' JOIN contacts c ON e.contactId = c.id';
          conditions.push('c.userId = ?');
          params.push(where.contact.userId);
        }
        
        query += ' WHERE 1=1';
        
        if (where.timestamp) {
          if (where.timestamp.gte) {
            conditions.push('e.timestamp >= ?');
            params.push(where.timestamp.gte);
          }
          if (where.timestamp.lte) {
            conditions.push('e.timestamp <= ?');
            params.push(where.timestamp.lte);
          }
        }
        if (where.campaignId) {
          conditions.push('e.campaignId = ?');
          params.push(where.campaignId);
        }
        
        if (conditions.length > 0) {
          query += ' AND ' + conditions.join(' AND ');
        }
        
        query += ` GROUP BY ${groupFields}`;
        
        const [rows] = await pool.query(query, params);
        return rows.map(row => ({
          ...row,
          _count: { [Object.keys(_count)[0] || 'type']: row.count }
        }));
      } catch (err) {
        console.error('❌ Event.groupBy error:', err.message);
        return [];
      }
    },
  },
  $transaction: async (queries) => {
    // If it's an array of promises, await them all
    if (Array.isArray(queries)) {
      return Promise.all(queries);
    }
    // If it's a callback, pass prismaProxy
    if (typeof queries === 'function') {
      return queries(prismaProxy);
    }
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

prismaProxy.getPool = getPool;
module.exports = prismaProxy;
