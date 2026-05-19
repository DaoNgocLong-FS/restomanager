const db = require('../database/db');

class TableModel {
  /** Returns tables with computed status from current open orders */
  static async findAllWithStatus(zone) {
    const params = [];
    let where = '';
    if (zone && zone !== 'all') {
      params.push(zone);
      where = `WHERE t.zone = $${params.length}`;
    }
    return db.query(
      `SELECT t.*,
        COALESCE(o.status, 'empty')         AS order_status,
        COALESCE(o.total_amount, 0)         AS spent,
        o.id                                 AS open_order_id,
        o.code                               AS open_order_code,
        o.check_in_time
       FROM tables t
       LEFT JOIN LATERAL (
         SELECT * FROM orders
         WHERE table_id = t.id AND status IN ('pending','serving')
         ORDER BY created_at DESC LIMIT 1
       ) o ON TRUE
       ${where}
       ORDER BY t.code`,
      params
    );
  }

  static async findAll() {
    return db.query('SELECT * FROM tables ORDER BY code');
  }

  static async findById(id) {
    return db.queryOne('SELECT * FROM tables WHERE id = $1', [id]);
  }

  static async findByCode(code) {
    return db.queryOne('SELECT * FROM tables WHERE code = $1', [code]);
  }

  /** Trả về order đang mở (pending/serving) trên bàn này, hoặc null. */
  static async findOpenOrder(tableId) {
    return db.queryOne(
      `SELECT id, code, status, total_amount, table_code
       FROM orders
       WHERE table_id = $1 AND status IN ('pending','serving')
       ORDER BY created_at DESC LIMIT 1`,
      [tableId]
    );
  }

  static async create({ code, zone, capacity }) {
    return db.queryOne(
      `INSERT INTO tables (code, zone, capacity) VALUES ($1,$2,$3) RETURNING *`,
      [code, zone, capacity]
    );
  }

  static async update(id, { code, zone, capacity, is_active }) {
    return db.queryOne(
      `UPDATE tables SET
        code = COALESCE($1, code),
        zone = COALESCE($2, zone),
        capacity = COALESCE($3, capacity),
        is_active = COALESCE($4, is_active)
       WHERE id = $5 RETURNING *`,
      [code, zone, capacity, is_active, id]
    );
  }

  /**
   * Bật/tắt 1 bàn (is_active).
   * Khi tắt: bàn KHÔNG được có order đang mở.
   * Trả về { table, openOrder } - openOrder !== null nghĩa là blocked.
   */
  static async setActive(id, is_active) {
    const t = await this.findById(id);
    if (!t) return { table: null, openOrder: null };

    if (is_active === false) {
      const openOrder = await this.findOpenOrder(id);
      if (openOrder) return { table: t, openOrder };
    }

    const updated = await db.queryOne(
      `UPDATE tables SET is_active = $1 WHERE id = $2 RETURNING *`,
      [is_active, id]
    );
    return { table: updated, openOrder: null };
  }

  static async remove(id) {
    return db.queryOne('DELETE FROM tables WHERE id = $1 RETURNING id', [id]);
  }
}

module.exports = TableModel;
