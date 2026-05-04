const bcrypt = require('bcryptjs');
const db = require('../database/db');

class UserModel {
  static async findByUsername(username) {
    return db.queryOne('SELECT * FROM users WHERE username = $1', [username]);
  }

  static async findById(id) {
    return db.queryOne('SELECT * FROM users WHERE id = $1', [id]);
  }

  static async findAll() {
    return db.query(
      `SELECT id, username, full_name, role, email, phone, avatar_url, is_active, created_at
       FROM users ORDER BY created_at DESC`
    );
  }

  static async verifyPassword(user, plain) {
    if (!user) return false;
    return bcrypt.compare(plain, user.password_hash);
  }

  static async create({ username, password, full_name, role, email, phone }) {
    const password_hash = await bcrypt.hash(password, 10);
    const row = await db.queryOne(
      `INSERT INTO users (username, password_hash, full_name, role, email, phone)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, username, full_name, role, email, phone, avatar_url, is_active, created_at`,
      [username, password_hash, full_name, role, email || null, phone || null]
    );
    return row;
  }

  static async update(id, { full_name, role, email, phone, is_active }) {
    return db.queryOne(
      `UPDATE users SET
         full_name = COALESCE($1, full_name),
         role      = COALESCE($2, role),
         email     = COALESCE($3, email),
         phone     = COALESCE($4, phone),
         is_active = COALESCE($5, is_active),
         updated_at = NOW()
       WHERE id = $6
       RETURNING id, username, full_name, role, email, phone, avatar_url, is_active, created_at`,
      [full_name ?? null, role ?? null, email ?? null, phone ?? null, is_active ?? null, id]
    );
  }

  static async resetPassword(id, newPassword) {
    const password_hash = await bcrypt.hash(newPassword, 10);
    return db.queryOne(
      `UPDATE users SET password_hash = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, username, full_name, role`,
      [password_hash, id]
    );
  }

  static async remove(id) {
    return db.queryOne(`DELETE FROM users WHERE id = $1 RETURNING id`, [id]);
  }

  static publicView(u) {
    if (!u) return null;
    const { password_hash, ...rest } = u;
    return rest;
  }
}

module.exports = UserModel;
