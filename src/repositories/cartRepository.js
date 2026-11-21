
const db = require("../config/database");

async function getOrCreateCart(userId, client = db) {
  const result = await client.query(
    `INSERT INTO public.carts (user_id)
     VALUES ($1)
     ON CONFLICT (user_id)
     DO UPDATE SET updated_at = public.carts.updated_at
     RETURNING id, user_id, created_at, updated_at`,
    [userId]
  );

  return result.rows[0];
}

async function getCartItems(cartId, client = db) {
  const result = await client.query(
    `SELECT
       ci.id,
       ci.cart_id,
       ci.product_id,
       ci.quantity,
       p.name,
       p.description,
       p.price,
       p.stock_quantity,
       p.minimum_order_quantity,
       p.unit,
       p.status,
       p.seller_id,
       (
         SELECT pi.image_url
         FROM public.product_images pi
         WHERE pi.product_id = p.id
         ORDER BY pi.is_primary DESC, pi.created_at
         LIMIT 1
       ) AS image_url
     FROM public.cart_items ci
     JOIN public.products p ON p.id = ci.product_id
     WHERE ci.cart_id = $1
     ORDER BY ci.created_at`,
    [cartId]
  );

  return result.rows;
}

async function getCartItem(cartId, itemId, client = db) {
  const result = await client.query(
    `SELECT *
     FROM public.cart_items
     WHERE cart_id = $1 AND id = $2`,
    [cartId, itemId]
  );

  return result.rows[0] || null;
}

async function getProductForCart(productId, client = db) {
  const result = await client.query(
    `SELECT id, name, price, stock_quantity,
            minimum_order_quantity, status
     FROM public.products
     WHERE id = $1`,
    [productId]
  );

  return result.rows[0] || null;
}

module.exports = {
  getOrCreateCart,
  getCartItems,
  getCartItem,
  getProductForCart
};
