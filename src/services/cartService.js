
const db = require("../config/database");
const repository = require("../repositories/cartRepository");
const ApiError = require("../utils/ApiError");

function roundMoney(value) {
  return Math.round(
    (Number(value) + Number.EPSILON) * 100
  ) / 100;
}

function validateQuantity(product, quantity) {
  if (!product || product.status !== "ACTIVE") {
    throw new ApiError(
      404,
      "PRODUCT_NOT_AVAILABLE",
      "This product is not available."
    );
  }

  if (quantity < Number(product.minimum_order_quantity)) {
    throw new ApiError(
      422,
      "MINIMUM_ORDER_QUANTITY",
      `Minimum order quantity is ${product.minimum_order_quantity}.`
    );
  }

  if (quantity > product.stock_quantity) {
    throw new ApiError(
      409,
      "INSUFFICIENT_STOCK",
      "The requested quantity exceeds available stock."
    );
  }
}

async function getCart(userId) {
  const cart = await repository.getOrCreateCart(userId);
  const items = await repository.getCartItems(cart.id);

  let subtotalCents = 0;

  const mappedItems = items.map((item) => {
    const priceCents = Math.round(
      Number(item.price) * 100
    );

    const quantity = Number(item.quantity);
    const lineCents = priceCents * quantity;

    subtotalCents += lineCents;

    return {
      id: item.id,
      product_id: item.product_id,
      name: item.name,
      description: item.description,
      image_url: item.image_url,
      unit: item.unit,
      price: roundMoney(item.price),
      quantity,
      stock_quantity: item.stock_quantity,
      line_total: lineCents / 100,
      available:
        item.status === "ACTIVE" &&
        quantity >= Number(item.minimum_order_quantity) &&
        quantity <= item.stock_quantity
    };
  });

  return {
    id: cart.id,
    items: mappedItems,
    subtotal: subtotalCents / 100,
    total: subtotalCents / 100,
    item_count: mappedItems.reduce(
      (sum, item) => sum + item.quantity,
      0
    ),
    currency: "PHP",
    can_checkout:
      mappedItems.length > 0 &&
      mappedItems.every((item) => item.available)
  };
}

async function addItem(userId, data) {
  await db.withTransaction(async (client) => {
    const cart = await repository.getOrCreateCart(
      userId,
      client
    );

    // Serialize modifications to this customer's cart.
    await client.query(
      "SELECT id FROM public.carts WHERE id = $1 FOR UPDATE",
      [cart.id]
    );

    const product = await client.query(
      `SELECT id, name, price, status,
              stock_quantity, minimum_order_quantity
       FROM public.products
       WHERE id = $1
       FOR SHARE`,
      [data.product_id]
    );

    const selected = product.rows[0];

    const existing = await client.query(
      `SELECT id, quantity
       FROM public.cart_items
       WHERE cart_id = $1 AND product_id = $2
       FOR UPDATE`,
      [cart.id, data.product_id]
    );

    const currentQuantity = existing.rows.reduce(
      (sum, row) => sum + Number(row.quantity),
      0
    );

    const newQuantity = currentQuantity + data.quantity;

    validateQuantity(selected, newQuantity);

    if (existing.rowCount) {
      await client.query(
        `UPDATE public.cart_items
         SET quantity = $1, updated_at = NOW()
         WHERE id = $2`,
        [newQuantity, existing.rows[0].id]
      );

      // Clean up duplicate cart lines if legacy data
      // contains more than one row per product.
      if (existing.rowCount > 1) {
        await client.query(
          `DELETE FROM public.cart_items
           WHERE cart_id = $1
             AND product_id = $2
             AND id <> $3`,
          [cart.id, data.product_id, existing.rows[0].id]
        );
      }
    } else {
      await client.query(
        `INSERT INTO public.cart_items
         (cart_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [cart.id, data.product_id, data.quantity]
      );
    }
  });

  return getCart(userId);
}

async function updateItem(userId, itemId, quantity) {
  await db.withTransaction(async (client) => {
    const cart = await repository.getOrCreateCart(
      userId,
      client
    );

    await client.query(
      "SELECT id FROM public.carts WHERE id = $1 FOR UPDATE",
      [cart.id]
    );

    const item = await repository.getCartItem(
      cart.id,
      itemId,
      client
    );

    if (!item) {
      throw new ApiError(
        404,
        "CART_ITEM_NOT_FOUND",
        "Cart item not found."
      );
    }

    const productResult = await client.query(
      `SELECT id, status, stock_quantity,
              minimum_order_quantity
       FROM public.products
       WHERE id = $1
       FOR SHARE`,
      [item.product_id]
    );

    validateQuantity(productResult.rows[0], quantity);

    await client.query(
      `UPDATE public.cart_items
       SET quantity = $1, updated_at = NOW()
       WHERE id = $2`,
      [quantity, itemId]
    );
  });

  return getCart(userId);
}

async function removeItem(userId, itemId) {
  const cart = await repository.getOrCreateCart(userId);

  const result = await db.query(
    `DELETE FROM public.cart_items
     WHERE id = $1 AND cart_id = $2
     RETURNING id`,
    [itemId, cart.id]
  );

  if (!result.rowCount) {
    throw new ApiError(
      404,
      "CART_ITEM_NOT_FOUND",
      "Cart item not found."
    );
  }

  return getCart(userId);
}

module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem
};
