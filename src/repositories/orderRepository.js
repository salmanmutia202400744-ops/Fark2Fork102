
const { pool } = require("../config/database");

async function findCustomerOrders(customerId, limit, offset) {
  const result = await pool.query(
    `SELECT
       o.id,
       o.order_number,
       o.customer_id,
       o.address_id,
       o.subtotal,
       o.discount_amount,
       o.delivery_fee,
       o.total_amount,
       o.status,
       o.created_at,
       o.updated_at,
       COUNT(*) OVER()::integer AS total_count
     FROM orders o
     WHERE o.customer_id = $1
     ORDER BY o.created_at DESC, o.id DESC
     LIMIT $2 OFFSET $3`,
    [customerId, limit, offset]
  );

  return result.rows;
}

async function countCustomerOrders(customerId) {
  const result = await pool.query(
    `SELECT COUNT(*)::integer AS total
     FROM orders
     WHERE customer_id = $1`,
    [customerId]
  );

  return result.rows[0].total;
}

async function findCustomerOrder(orderId, customerId) {
  const result = await pool.query(
    `SELECT
       o.id,
       o.order_number,
       o.customer_id,
       o.address_id,
       o.subtotal,
       o.discount_amount,
       o.delivery_fee,
       o.total_amount,
       o.status,
       o.created_at,
       o.updated_at
     FROM orders o
     WHERE o.id = $1
       AND o.customer_id = $2`,
    [orderId, customerId]
  );

  return result.rows[0] || null;
}

async function findOrderItems(orderId) {
  const result = await pool.query(
    `SELECT
       so.id AS seller_order_id,
       so.seller_id,
       oi.product_id,
       oi.product_name,
       oi.unit,
       oi.quantity,
       oi.unit_price,
       oi.subtotal
     FROM seller_orders so
     JOIN order_items oi
       ON oi.seller_order_id = so.id
     WHERE so.order_id = $1
     ORDER BY so.id, oi.product_id`,
    [orderId]
  );

  return result.rows;
}

async function findOrderReservations(orderId) {
  const result = await pool.query(
    `SELECT
       product_id,
       quantity,
       status,
       expires_at
     FROM inventory_reservations
     WHERE order_id = $1
     ORDER BY product_id`,
    [orderId]
  );

  return result.rows;
}

module.exports = {
  findCustomerOrders,
  countCustomerOrders,
  findCustomerOrder,
  findOrderItems,
  findOrderReservations
};
