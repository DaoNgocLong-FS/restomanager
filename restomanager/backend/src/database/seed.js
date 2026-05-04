const bcrypt = require('bcryptjs');
const db = require('./db');

/**
 * Seed initial accounts (admin, cashier, waiter) with password '123'.
 * Idempotent — chỉ insert nếu chưa có user nào.
 */
async function runSeed() {
  const existing = await db.queryOne('SELECT COUNT(*)::int AS count FROM users');
  if (existing && existing.count > 0) {
    console.log(`👥 Đã có ${existing.count} user trong DB — bỏ qua seed`);
    return;
  }

  const hash = await bcrypt.hash('123', 10);
  const seed = [
    { username: 'admin',   role: 'admin',   full_name: 'Nguyễn Văn Dũng' },
    { username: 'cashier', role: 'cashier', full_name: 'Trần Thị Lan' },
    { username: 'waiter',  role: 'waiter',  full_name: 'Hoàng Nam' },
  ];

  for (const u of seed) {
    await db.query(
      `INSERT INTO users (username, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4) ON CONFLICT (username) DO NOTHING`,
      [u.username, hash, u.full_name, u.role]
    );
  }
  console.log('🌱 Seed users hoàn tất (admin/cashier/waiter — pw: 123)');
}

module.exports = { runSeed };

if (require.main === module) {
  runSeed().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
}
