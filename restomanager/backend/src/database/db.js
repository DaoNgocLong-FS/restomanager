const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      }
    : {
        host:     process.env.DB_HOST     || 'postgres',
        port:     parseInt(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME     || 'restaurant_db',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
      }
);

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err.message);
});

async function waitForDb(maxRetries = 30, delayMs = 2000) {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const client = await pool.connect();
      await client.query('SELECT 1');
      client.release();
      console.log('✅ Connected to PostgreSQL');
      return;
    } catch (err) {
      console.log(`⏳ Postgres chưa sẵn sàng (${i}/${maxRetries})... ${err.message}`);
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Không thể kết nối PostgreSQL sau khi chờ');
}

async function initDatabase() {
  await waitForDb();

  const migrationsDir = path.join(__dirname, '..', '..', 'migrations');
  const files = fs.existsSync(migrationsDir)
    ? fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort()
    : [];

  const client = await pool.connect();
  try {
    for (const f of files) {
      const sql = fs.readFileSync(path.join(migrationsDir, f), 'utf-8');
      console.log(`📦 Running migration: ${f}`);
      await client.query(sql);
    }
    console.log('✅ Database migrated — tất cả bảng đã sẵn sàng');
  } finally {
    client.release();
  }
}

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] ?? null;
}

async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function closePool() { await pool.end(); }

module.exports = { initDatabase, query, queryOne, transaction, closePool, pool };
