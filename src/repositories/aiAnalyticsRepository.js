
const db = require("../config/database");

// Get authenticated seller profile
async function getSeller(userId) {
  const result = await db.query(
    `SELECT id, store_name
     FROM public.seller_profiles
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

// Include only fully paid orders without reversals
const verifiedPayment = `
  EXISTS (
    SELECT 1
    FROM public.payments pay
    WHERE pay.order_id = o.id
      AND pay.status = 'PAID'
      AND pay.amount = o.total_amount
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.payments pay
    WHERE pay.order_id = o.id
      AND pay.status IN ('REFUNDED', 'CANCELLED')
  )
  AND o.status IN (
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED'
  )
  AND so.status IN (
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'DELIVERED'
  )
`;

// Seller revenue and order summary
async function getSalesSummary(sellerId, days) {
  const result = await db.query(
    `SELECT
       COUNT(*)::integer AS total_orders,

       COALESCE(
         SUM(so.subtotal), 0
       ) AS product_revenue,

       COALESCE(
         SUM(so.delivery_fee), 0
       ) AS delivery_fees,

       COALESCE(
         SUM(so.total_amount), 0
       ) AS total_revenue,

       COUNT(*) FILTER (
         WHERE so.status = 'DELIVERED'
       )::integer AS delivered_orders

     FROM public.seller_orders so
     JOIN public.orders o
       ON o.id = so.order_id

     WHERE so.seller_id = $1
       AND o.created_at >=
         NOW() - ($2::integer * INTERVAL '1 day')
       AND ${verifiedPayment}`,
    [sellerId, days]
  );

  return result.rows[0];
}

// Best-selling products
async function getTopProducts(sellerId, days) {
  const result = await db.query(
    `SELECT
       oi.product_id,
       oi.product_name,
       oi.unit,

       SUM(oi.quantity) AS quantity_sold,

       SUM(oi.subtotal) AS revenue

     FROM public.order_items oi

     JOIN public.seller_orders so
       ON so.id = oi.seller_order_id

     JOIN public.orders o
       ON o.id = so.order_id

     WHERE so.seller_id = $1
       AND o.created_at >=
         NOW() - ($2::integer * INTERVAL '1 day')
       AND ${verifiedPayment}

     GROUP BY
       oi.product_id,
       oi.product_name,
       oi.unit

     ORDER BY revenue DESC

     LIMIT 10`,
    [sellerId, days]
  );

  return result.rows;
}

// Daily sales history
async function getDailySales(sellerId, days) {
  const result = await db.query(
    `SELECT
       TO_CHAR(
         o.created_at AT TIME ZONE 'Asia/Manila',
         'YYYY-MM-DD'
       ) AS date,

       COUNT(*)::integer AS orders,

       SUM(so.subtotal) AS revenue

     FROM public.seller_orders so

     JOIN public.orders o
       ON o.id = so.order_id

     WHERE so.seller_id = $1
       AND o.created_at >=
         NOW() - ($2::integer * INTERVAL '1 day')
       AND ${verifiedPayment}

     GROUP BY 1
     ORDER BY 1`,
    [sellerId, days]
  );

  return result.rows;
}

// Seller inventory
async function getInventory(sellerId) {
  const result = await db.query(
    `SELECT
       p.id,
       p.name,
       p.price,
       p.unit,
       p.stock_quantity,
       p.minimum_order_quantity,
       p.status,
       p.expiry_date,

       p.stock_quantity * p.price
         AS inventory_value,

       CASE
         WHEN p.expiry_date <
           (NOW() AT TIME ZONE 'Asia/Manila')::date
           THEN 'EXPIRED'

         WHEN p.stock_quantity = 0
           THEN 'OUT_OF_STOCK'

         WHEN p.stock_quantity <
           p.minimum_order_quantity
           THEN 'BELOW_MINIMUM'

         WHEN p.stock_quantity <= 10
           THEN 'LOW_STOCK'

         ELSE 'HEALTHY'
       END AS stock_status,

       CASE
         WHEN p.expiry_date BETWEEN
           (NOW() AT TIME ZONE 'Asia/Manila')::date
           AND
           (NOW() AT TIME ZONE 'Asia/Manila')::date + 7
           THEN true
         ELSE false
       END AS expiring_soon

     FROM public.products p

     WHERE p.seller_id = $1
       AND p.status = 'ACTIVE'

     ORDER BY p.stock_quantity ASC, p.name`,
    [sellerId]
  );

  return result.rows;
}

module.exports = {
  getSeller,
  getSalesSummary,
  getTopProducts,
  getDailySales,
  getInventory
};
