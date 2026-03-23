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
        return rows[0] || null;
      } catch (err) {
        console.error('❌ Contact.findFirst error:', err.message);
        throw err;
      }
    },
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {}, include = {} }) => {
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
            // Each orCondition has one property like { email: { contains: '...' } }
            const key = Object.keys(orCondition)[0];
            const value = orCondition[key];
            
            if (value && value.contains) {
              const searchTerm = `%${value.contains}%`;
              if (key === 'leadListName') {
                orConditions.push(`lead_list_name LIKE ?`);
              } else {
                orConditions.push(`${key} LIKE ?`);
              }
              orParams.push(searchTerm);
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
        
        return rows;
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
        
        const insertData = {
          id,
          userId: data.userId,
          email: data.email,
          firstName: data.firstName || null,
          lastName: data.lastName || null,
          company: data.company || null,
          lead_list_name: data.leadListName || null,
          timezone: data.timezone || 'UTC',
          status: data.status || 'ACTIVE',
          createdAt: now,
          updatedAt: now
        };
        
        const keys = Object.keys(insertData);
        const values = Object.values(insertData);
        const placeholders = keys.map(() => '?').join(', ');
        
        await pool.query(
          `INSERT INTO contacts (${keys.join(', ')}) VALUES (${placeholders})`,
          values
        );
        
        return insertData;
      } catch (err) {
        console.error('❌ Contact.create error:', err.message);
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
    count: async ({ where = {} }) => {
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
    groupBy: async ({ by, where = {}, _count = {}, orderBy = {} }) => {
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
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {}, include = {} }) => {
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
    findFirst: async ({ where }) => {
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
        return rows[0] || null;
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
    count: async ({ where = {} }) => {
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
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {} }) => {
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
          'SELECT id FROM sequence_triggers WHERE sequence_id = ? AND trigger_type = ?',
          [where.sequenceId, where.triggerType]
        );
        
        if (existing[0]?.length > 0) {
          // Update existing
          const updates = Object.keys(update).map(k => `${k} = ?`).join(', ');
          const values = Object.values(update);
          values.push(where.sequenceId);
          await pool.query(
            `UPDATE sequence_triggers SET ${updates} WHERE sequence_id = ?`,
            values
          );
          return { ...update };
        } else {
          // Create new
          const id = require('crypto').randomBytes(8).toString('hex').toUpperCase();
          const now = new Date();
          const insertData = { id, ...create, sequence_id: where.sequenceId, createdAt: now, updatedAt: now };
          
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
    findUnique: async ({ where }) => {
      try {
        const pool = await getPool();
        const [rows] = await pool.query(
          'SELECT * FROM sequence_triggers WHERE sequence_id = ?',
          [where.sequenceId]
        );
        return rows[0] || null;
      } catch (err) {
        console.error('❌ SequenceTrigger.findUnique error:', err.message);
        throw err;
      }
    },
  },
  enrollment: {
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {}, include = {} }) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM enrollments WHERE 1=1';
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
        
        return rows;
      } catch (err) {
        console.error('❌ Enrollment.findMany error:', err.message);
        return [];
      }
    },
    count: async ({ where = {} }) => {
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
  },
  emailConfig: {
    findMany: async ({ where = {} }) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM email_configs WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND user_id = ?';
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
        const [rows] = await pool.query('SELECT * FROM email_configs WHERE id = ? LIMIT 1', [where.id]);
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
        
        const insertData = {
          id,
          user_id: data.userId,
          imap_host: data.imapHost || null,
          imap_user: data.imapUser || null,
          imap_password: data.imapPassword || null,
          smtp_host: data.smtpHost || null,
          smtp_port: data.smtpPort || null,
          smtp_user: data.smtpUser || null,
          smtp_password: data.smtpPassword || null,
          createdAt: now,
          updatedAt: now
        };
        
        const keys = Object.keys(insertData);
        const vals = Object.values(insertData);
        const placeholders = keys.map(() => '?').join(', ');
        
        await pool.query(
          `INSERT INTO email_configs (${keys.join(', ')}) VALUES (${placeholders})`,
          vals
        );
        
        return { id, ...data };
      } catch (err) {
        console.error('❌ EmailConfig.create error:', err.message);
        throw err;
      }
    },
  },
  campaign: {
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {}, include = {} }) => {
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
    count: async ({ where = {} }) => {
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
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {}, include = {} }) => {
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
    count: async ({ where = {} }) => {
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
          query += ' AND campaign_id = ?';
          params.push(where.campaignId);
        }
        if (where.contactId) {
          query += ' AND contact_id = ?';
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
    count: async ({ where = {} }) => {
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
  },
  emailActivity: {
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {} }) => {
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
    count: async ({ where = {} }) => {
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
    findMany: async ({ where = {}, skip = 0, take = 100, orderBy = {} }) => {
      try {
        const pool = await getPool();
        let query = 'SELECT * FROM events WHERE 1=1';
        const params = [];
        
        if (where.userId) {
          query += ' AND user_id = ?';
          params.push(where.userId);
        }
        if (where.type) {
          query += ' AND type = ?';
          params.push(where.type);
        }
        
        const orderField = Object.keys(orderBy)[0] || 'createdAt';
        const orderDir = orderBy[orderField] === 'asc' ? 'ASC' : 'DESC';
        query += ` ORDER BY ${orderField} ${orderDir} LIMIT ${take} OFFSET ${skip}`;
        
        const [rows] = await pool.query(query, params);
        return rows || [];
      } catch (err) {
        console.error('❌ Event.findMany error:', err.message);
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
          user_id: data.userId,
          type: data.type,
          data: data.data ? JSON.stringify(data.data) : null,
          createdAt: now,
          updatedAt: now
        };
        
        const keys = Object.keys(insertData);
        const vals = Object.values(insertData);
        const placeholders = keys.map(() => '?').join(', ');
        
        await pool.query(
          `INSERT INTO events (${keys.join(', ')}) VALUES (${placeholders})`,
          vals
        );
        
        return { id, ...data };
      } catch (err) {
        console.error('❌ Event.create error:', err.message);
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
