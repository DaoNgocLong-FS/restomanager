const db = require('../database/db');

class MenuItemModel {
  static async findAll(filters = {}) {
    const conditions = [];
    const params = [];
    if (filters.is_active !== undefined) {
      params.push(filters.is_active);
      conditions.push(`mi.is_active = $${params.length}`);
    }
    if (filters.category_code) {
      params.push(filters.category_code);
      conditions.push(`mc.code = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    return db.query(
      `SELECT mi.*, mc.code AS category_code, mc.name AS category_name
       FROM menu_items mi
       LEFT JOIN menu_categories mc ON mc.id = mi.category_id
       ${where}
       ORDER BY mc.sort_order, mi.name`,
      params
    );
  }

  static async findById(id) {
    return db.queryOne(
      `SELECT mi.*, mc.code AS category_code, mc.name AS category_name
       FROM menu_items mi LEFT JOIN menu_categories mc ON mc.id = mi.category_id
       WHERE mi.id = $1`, [id]
    );
  }

  static async create({ name, description, price, category_id, emoji, image_url, image_key }) {
    return db.queryOne(
      `INSERT INTO menu_items (name, description, price, category_id, emoji, image_url, image_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, description || null, price, category_id || null, emoji || null, image_url || null, image_key || null]
    );
  }

  static async update(id, { name, description, price, category_id, emoji, image_url, image_key, is_active }) {
    return db.queryOne(
      `UPDATE menu_items SET
         name = COALESCE($1, name),
         description = COALESCE($2, description),
         price = COALESCE($3, price),
         category_id = COALESCE($4, category_id),
         emoji = COALESCE($5, emoji),
         image_url = COALESCE($6, image_url),
         image_key = COALESCE($7, image_key),
         is_active = COALESCE($8, is_active),
         updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [name, description, price, category_id, emoji, image_url, image_key, is_active, id]
    );
  }

  static async remove(id) {
    return db.queryOne('DELETE FROM menu_items WHERE id = $1 RETURNING image_key', [id]);
  }

  static async listCategories() {
    return db.query('SELECT * FROM menu_categories ORDER BY sort_order, name');
  }
}

module.exports = MenuItemModel;
