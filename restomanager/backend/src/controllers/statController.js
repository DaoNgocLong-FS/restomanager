const db = require('../database/db');
const { ok, asyncHandler, ApiError } = require('../utils/response');

/**
 * GET /api/stats/overview?from=ISO&to=ISO&cashier_id=N
 * Tổng quan cho Admin Dashboard (mặc định: hôm nay).
 */
exports.overview = asyncHandler(async (req, res) => {
  let { from, to, cashier_id } = req.query;
  if (!from) from = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
  if (!to)   to   = new Date(new Date().setHours(23, 59, 59, 999)).toISOString();

  const params = [from, to];
  let cashierFilter = '';
  if (cashier_id) {
    if (isNaN(Number(cashier_id))) throw ApiError.badRequest('cashier_id phải là số');
    params.push(cashier_id);
    cashierFilter = ` AND cashier_id = $${params.length}`;
  }

  const summary = await db.queryOne(
    `SELECT
       COUNT(*)::int                          AS invoice_count,
       COALESCE(SUM(final_amount),0)::numeric AS total_revenue,
       COALESCE(AVG(final_amount),0)::numeric AS avg_invoice
     FROM invoices
     WHERE created_at BETWEEN $1 AND $2 ${cashierFilter}`,
    params
  );

  const byHour = await db.query(
    `SELECT EXTRACT(HOUR FROM created_at)::int   AS hour,
            COALESCE(SUM(final_amount),0)::numeric AS revenue,
            COUNT(*)::int                        AS count
     FROM invoices
     WHERE created_at BETWEEN $1 AND $2 ${cashierFilter}
     GROUP BY 1 ORDER BY 1`,
    params
  );

  const byPaymentMethod = await db.query(
    `SELECT payment_method,
            COUNT(*)::int                        AS count,
            COALESCE(SUM(final_amount),0)::numeric AS revenue
     FROM invoices
     WHERE created_at BETWEEN $1 AND $2 ${cashierFilter}
     GROUP BY 1`,
    params
  );

  const topItems = await db.query(
    `SELECT ii.item_name                          AS name,
            SUM(ii.quantity)::int                  AS qty,
            MAX(ii.price)::numeric                 AS price,
            COALESCE(SUM(ii.total_price),0)::numeric AS revenue
     FROM invoice_items ii
     JOIN invoices i ON i.id = ii.invoice_id
     WHERE i.created_at BETWEEN $1 AND $2 ${cashierFilter}
     GROUP BY ii.item_name
     ORDER BY qty DESC LIMIT 5`,
    params
  );

  return ok(res, { summary, byHour, byPaymentMethod, topItems }, {
    meta: { from, to, cashier_id: cashier_id || null },
  });
});

/**
 * GET /api/stats/daily?days=14   (1..90)
 */
exports.daily = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days || 14), 1), 90);
  const rows = await db.query(
    `SELECT DATE(created_at) AS day,
            COUNT(*)::int   AS invoice_count,
            COALESCE(SUM(final_amount),0)::numeric AS revenue
     FROM invoices
     WHERE created_at >= NOW() - ($1 || ' days')::interval
     GROUP BY 1 ORDER BY 1`,
    [String(days)]
  );
  return ok(res, rows, { meta: { days } });
});
