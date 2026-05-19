const db = require('../database/db');
const OrderModel = require('./Order');

class InvoiceModel {
  static async checkout({
    order_id, cashier_id, cashier_name,
    discount = 0, discount_note,
    vat_rate = 8,
    payment_method = 'cash',
    paid_amount,           // số tiền khách trả (mặc định = final_amount nếu không truyền)
  }) {
    const order = await OrderModel.findById(order_id);
    if (!order) throw new Error('Order không tồn tại');
    if (order.status === 'cancelled') throw new Error('Không thể checkout order đã huỷ');
    if (order.status === 'completed') throw new Error('Order đã được thanh toán');
    if (discount < 0) throw new Error('Giảm giá không thể âm');
    if (Number(discount) > Number(order.total_amount)) throw new Error('Giảm giá không thể lớn hơn tổng tiền');

    const subTotal    = Number(order.total_amount) - Number(discount);
    const vatAmount   = Math.round((subTotal * Number(vat_rate)) / 100);
    const finalAmount = subTotal + vatAmount;

    // Tính tiền khách trả + tiền thừa
    const paid   = paid_amount === undefined || paid_amount === null
      ? finalAmount
      : Number(paid_amount);
    if (!Number.isFinite(paid) || paid < 0)
      throw new Error('paid_amount phải là số >= 0');
    if (paid < finalAmount)
      throw new Error(`Khách trả thiếu: cần ${finalAmount}, nhận ${paid}`);
    const change = paid - finalAmount;

    return db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO invoices
           (order_id, table_code, waiter_name, cashier_id, cashier_name,
            total_amount, discount, discount_note, vat_rate, vat_amount, final_amount,
            paid_amount, change_amount,
            check_in_time, check_out_time, payment_method)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW(),$15)
         RETURNING *`,
        [
          order_id, order.table_code, order.waiter_name, cashier_id || null, cashier_name,
          order.total_amount, discount, discount_note || null, vat_rate, vatAmount, finalAmount,
          paid, change,
          order.check_in_time, payment_method,
        ]
      );
      const invoice = rows[0];

      const insertedItems = [];
      for (const it of order.items) {
        const { rows: ir } = await client.query(
          `INSERT INTO invoice_items
            (invoice_id, order_item_id, item_name, quantity, price, total_price, notes)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
          [invoice.id, it.id, it.item_name, it.quantity, it.price, it.total_price, it.notes]
        );
        insertedItems.push(ir[0]);
      }

      await client.query(
        `UPDATE orders SET status = 'completed', check_out_time = NOW(), updated_at = NOW()
         WHERE id = $1`, [order_id]
      );

      invoice.items = insertedItems;
      return invoice;
    });
  }

  static async findById(id) {
    const inv = await db.queryOne('SELECT * FROM invoices WHERE id = $1', [id]);
    if (!inv) return null;
    return this._attachItems(inv);
  }

  static async findAll(filters = {}) {
    const conds = [];
    const params = [];
    if (filters.table_code) { params.push(filters.table_code); conds.push(`table_code = $${params.length}`); }
    if (filters.cashier_name) { params.push(`%${filters.cashier_name}%`); conds.push(`cashier_name ILIKE $${params.length}`); }
    if (filters.from) { params.push(filters.from); conds.push(`created_at >= $${params.length}`); }
    if (filters.to)   { params.push(filters.to);   conds.push(`created_at <= $${params.length}`); }
    const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const list = await db.query(
      `SELECT * FROM invoices ${where} ORDER BY created_at DESC`, params
    );
    return Promise.all(list.map(inv => this._attachItems(inv)));
  }

  static async _attachItems(invoice) {
    invoice.items = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id',
      [invoice.id]
    );
    return invoice;
  }
}

module.exports = InvoiceModel;
