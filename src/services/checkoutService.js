// src/services/checkoutService.js

const { randomUUID } = require("node:crypto");
const { pool } = require("../config/database");

async function createCheckoutOrder(userId, addressId, idempotencyKey) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Serialize checkout requests for the same customer.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      [userId]
    );

    const existing = await client.query(
      `SELECT id, order_number, total_amount, status
       FROM orders
       WHERE customer_id = $1 AND idempotency_key = $2`,
      [userId, idempotencyKey]
    );

    if (existing.rows.length) {
      await client.query("COMMIT");
      return { ...existing.rows[0], already_created: true };
    }

    const address = await client.query(
      `SELECT id FROM addresses
       WHERE id = $1 AND user_id = $2`,
      [addressId, userId]
    );

    if (!address.rowCount) {
      throw Object.assign(new Error("Delivery address not found"), {
        status: 404
      });
    }

    const cartResult = await client.query(
      `SELECT id FROM carts
       WHERE user_id = $1
       FOR UPDATE`,
      [userId]
    );

    if (!cartResult.rowCount) {
      throw Object.assign(new Error("Cart is empty"), {
        status: 400
      });
    }

    const cartId = cartResult.rows[0].id;

    // Lock cart items, then products in deterministic order.
    const cartItems = await client.query(
      `SELECT product_id, quantity
       FROM cart_items
       WHERE cart_id = $1
       ORDER BY product_id
       FOR UPDATE`,
      [cartId]
    );

    if (!cartItems.rowCount) {
      throw Object.assign(new Error("Cart is empty"), {
        status: 400
      });
    }

    const productIds = cartItems.rows.map(i => i.product_id);

    const productsResult = await client.query(
      `SELECT p.id, p.name, p.unit, p.price,
              p.stock_quantity, p.status, p.seller_id
       FROM products p
       WHERE p.id = ANY($1::uuid[])
       ORDER BY p.id
       FOR UPDATE OF p`,
      [productIds]
    );

    const products = new Map(
      productsResult.rows.map(p => [p.id, p])
    );

    let subtotalCents = 0;
    const lines = [];

    for (const item of cartItems.rows) {
      const product = products.get(item.product_id);
      const quantity = Number(item.quantity);

      if (
        !product ||
        product.status !== "ACTIVE" ||
        !Number.isSafeInteger(quantity) ||
        quantity <= 0 ||
        quantity > product.stock_quantity
      ) {
        throw Object.assign(
          new Error("Product unavailable or insufficient stock"),
          { status: 409 }
        );
      }

      const priceCents = Math.round(Number(product.price) * 100);

      if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
        throw Object.assign(new Error("Invalid product price"), {
          status: 409
        });
      }

      const lineCents = priceCents * quantity;

      if (!Number.isSafeInteger(lineCents)) {
        throw Object.assign(new Error("Order amount is too large"), {
          status: 400
        });
      }

      subtotalCents += lineCents;

      if (!Number.isSafeInteger(subtotalCents)) {
        throw Object.assign(new Error("Order amount is too large"), {
          status: 400
        });
      }

      lines.push({ product, quantity, priceCents, lineCents });
    }

    const subtotal = (subtotalCents / 100).toFixed(2);
    const orderNumber = `F2F-${randomUUID()}`;

    const orderResult = await client.query(
      `INSERT INTO orders (
         order_number, customer_id, address_id,
         subtotal, discount_amount, delivery_fee,
         total_amount, status, idempotency_key
       )
       VALUES ($1, $2, $3, $4, 0, 0, $4, 'PENDING', $5)
       RETURNING id, order_number, total_amount, status`,
      [orderNumber, userId, addressId, subtotal, idempotencyKey]
    );

    const order = orderResult.rows[0];

    const grouped = new Map();

    for (const line of lines) {
      const sellerId = line.product.seller_id;

      if (!grouped.has(sellerId)) grouped.set(sellerId, []);
      grouped.get(sellerId).push(line);
    }

    for (const [sellerId, sellerLines] of grouped) {
      const sellerCents = sellerLines.reduce(
        (sum, line) => sum + line.lineCents, 0
      );
      const sellerTotal = (sellerCents / 100).toFixed(2);

      const sellerOrderResult = await client.query(
        `INSERT INTO seller_orders (
           order_id, seller_id, subtotal,
           delivery_fee, total_amount
         )
         VALUES ($1, $2, $3, 0, $3)
         RETURNING id`,
        [order.id, sellerId, sellerTotal]
      );

      const sellerOrderId = sellerOrderResult.rows[0].id;

      for (const line of sellerLines) {
        const p = line.product;

        await client.query(
          `INSERT INTO order_items (
             seller_order_id, product_id, product_name,
             unit, quantity, unit_price, subtotal
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            sellerOrderId,
            p.id,
            p.name,
            p.unit,
            line.quantity,
            (line.priceCents / 100).toFixed(2),
            (line.lineCents / 100).toFixed(2)
          ]
        );
      }
    }

    for (const line of lines) {
      await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $1,
             updated_at = NOW()
         WHERE id = $2`,
        [line.quantity, line.product.id]
      );

      await client.query(
        `INSERT INTO inventory_reservations (
           order_id, product_id, quantity,
           status, expires_at
         )
         VALUES ($1, $2, $3, 'ACTIVE',
                 NOW() + INTERVAL '30 minutes')`,
        [order.id, line.product.id, line.quantity]
      );
    }

    await client.query(
      "DELETE FROM cart_items WHERE cart_id = $1",
      [cartId]
    );

    await client.query("COMMIT");

    return { ...order, already_created: false };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createCheckoutOrder };