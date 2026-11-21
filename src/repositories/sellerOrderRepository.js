
const { pool } = require("../config/database");

// Get orders belonging to one seller
async function findSellerOrders(sellerId, limit, offset) {
  const result = await pool.query(
    `SELECT
       so.id,
       so.order_id,
       so.seller_id,
       so.subtotal,
       so.delivery_fee,
       so.total_amount,
       so.status AS seller_order_status,
       o.order_number,
       o.status AS order_status,
       o.created_at,
       o.updated_at
     FROM seller_orders so
     JOIN orders o ON o.id = so.order_id
     WHERE so.seller_id = $1
     ORDER BY o.created_at DESC, so.id DESC
     LIMIT $2 OFFSET $3`,
    [sellerId, limit, offset]
  );

  return result.rows;
}

// Count seller orders
async function countSellerOrders(sellerId) {
  const result = await pool.query(
    `SELECT COUNT(*)::integer AS total
     FROM seller_orders
     WHERE seller_id = $1`,
    [sellerId]
  );

  return result.rows[0].total;
}

// Get one seller order
async function findSellerOrder(sellerOrderId, sellerId) {
  const result = await pool.query(
    `SELECT
       so.id,
       so.order_id,
       so.seller_id,
       so.subtotal,
       so.delivery_fee,
       so.total_amount,
       so.status AS seller_order_status,
       o.order_number,
       o.status AS order_status,
       o.created_at,
       o.updated_at
     FROM seller_orders so
     JOIN orders o ON o.id = so.order_id
     WHERE so.id = $1
       AND so.seller_id = $2`,
    [sellerOrderId, sellerId]
  );

  return result.rows[0] || null;
}

// Get products purchased from this seller
async function findSellerOrderItems(sellerOrderId, sellerId) {
  const result = await pool.query(
    `SELECT
       oi.product_id,
       oi.product_name,
       oi.unit,
       oi.quantity,
       oi.unit_price,
       oi.subtotal
     FROM order_items oi
     JOIN seller_orders so
       ON so.id = oi.seller_order_id
     WHERE so.id = $1
       AND so.seller_id = $2
     ORDER BY oi.product_id`,
    [sellerOrderId, sellerId]
  );

  return result.rows;
}

async function findSellerProfileId(userId, client = pool) {
  const result = await client.query(
    `SELECT id
     FROM seller_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rows[0]?.id || null;
}

async function updateSellerOrderStatus(
  client,
  sellerOrderId,
  sellerId,
  nextStatus
) {
  const result = await client.query(
    `UPDATE seller_orders
     SET status = $1::order_status,
         updated_at = NOW()
     WHERE id = $2
       AND seller_id = $3
     RETURNING id, order_id, seller_id, status, updated_at`,
    [nextStatus, sellerOrderId, sellerId]
  );

  return result.rows[0] || null;
}


module.exports = {
  findSellerOrders,
  countSellerOrders,
  findSellerOrder,
  findSellerOrderItems,
  findSellerProfileId,
  updateSellerOrderStatus
};