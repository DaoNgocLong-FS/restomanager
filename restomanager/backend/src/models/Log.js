const db = require('../database/db');

class LogModel {
  static async write({ user_id, user_name, action, entity, entity_id, details, ip }) {
    await db.query(
      `INSERT INTO activity_logs (user_id, user_name, action, entity, entity_id, details, ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [user_id || null, user_name || null, action, entity || null, entity_id || null, details ? JSON.stringify(details) : null, ip || null]
    );
  }
  static async list({ from, to, action, user_name, limit = 200 } = {}) {
    const conds = [], params = [];
    if (from)   { params.push(from); conds.push(`created_at >= $${params.length}`); }
    if (to)     { params.push(to);   conds.push(`created_at <= $${params.length}`); }
    if (action) { params.push(action); conds.push(`action = $${params.length}`); }
    if (user_name) { params.push(`%${user_name}%`); conds.push(`user_name ILIKE $${params.length}`); }
    params.push(Math.min(limit, 1000));
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    return db.query(
      `SELECT * FROM activity_logs ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
      params
    );
  }
}

module.exports = LogModel;
