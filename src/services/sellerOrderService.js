
const { pool } = require("../config/database");
const repository = require("../repositories/sellerOrderRepository");
const ApiError = require("../utils/ApiError");

// Convert authenticated user ID into seller profile ID
async function getSellerProfileId(userId) {
  const result = await pool.query(
    `SELECT id
     FROM seller_profiles
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    throw new ApiError(
      404,
      "SELLER_PROFILE_NOT_FOUND",
      "Seller profile not found for this account."
    );
  }

  return result.rows[0].id;
}

// GET /api/v1/seller/orders
async function getSellerOrders(userId, page = 1, limit = 10) {
  const sellerId = await getSellerProfileId(userId);
  const offset = (page - 1) * limit;

  const [orders, total] = await Promise.all([
    repository.findSellerOrders(sellerId, limit, offset),
    repository.countSellerOrders(sellerId)
  ]);

  return {
    orders,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit)
    }
  };
}

// GET /api/v1/seller/orders/:id
async function getSellerOrderDetails(sellerOrderId, userId) {
  const sellerId = await getSellerProfileId(userId);

  const order = await repository.findSellerOrder(
    sellerOrderId,
    sellerId
  );

  if (!order) {
    throw new ApiError(
      404,
      "SELLER_ORDER_NOT_FOUND",
      "Seller order not found."
    );
  }

  const items = await repository.findSellerOrderItems(
    sellerOrderId,
    sellerId
  );

  return {
    ...order,
    items
  };
}

// GET /api/v1/seller/orders/:id/status
async function getSellerOrderStatus(sellerOrderId, userId) {
  const sellerId = await getSellerProfileId(userId);

  const order = await repository.findSellerOrder(
    sellerOrderId,
    sellerId
  );

  if (!order) {
    throw new ApiError(
      404,
      "SELLER_ORDER_NOT_FOUND",
      "Seller order not found."
    );
  }

  return {
    id: order.id,
    order_id: order.order_id,
    order_number: order.order_number,
    seller_order_status: order.seller_order_status,
    order_status: order.order_status,
    created_at: order.created_at,
    updated_at: order.updated_at
  };
}


async function updateStatus(sellerOrderId, userId, nextStatus) {
  const transitions = {
    CONFIRMED: "PROCESSING",
    PROCESSING: "SHIPPED",
    SHIPPED: "DELIVERED"
  };

  const allowedTargets = [
    "PROCESSING",
    "SHIPPED",
    "DELIVERED"
  ];

  if (!allowedTargets.includes(nextStatus)) {
    throw new ApiError(
      400,
      "INVALID_SELLER_STATUS",
      "Sellers may only request PROCESSING, SHIPPED or DELIVERED."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sellerId = await repository.findSellerProfileId(
      userId,
      client
    );

    if (!sellerId) {
      throw new ApiError(
        404,
        "SELLER_PROFILE_NOT_FOUND",
        "Seller profile not found."
      );
    }

    // First discover the parent order ID.
    // No row lock is taken in this preliminary lookup.
    const lookup = await client.query(
      `SELECT order_id
       FROM seller_orders
       WHERE id = $1
         AND seller_id = $2`,
      [sellerOrderId, sellerId]
    );

    if (!lookup.rowCount) {
      throw new ApiError(
        404,
        "SELLER_ORDER_NOT_FOUND",
        "Seller order not found."
      );
    }

    const orderId = lookup.rows[0].order_id;

    // Lock parent first, matching cancellation and
    // inventory cleanup lock ordering.
    const parentResult = await client.query(
      `SELECT id, status, total_amount
       FROM orders
       WHERE id = $1
       FOR UPDATE`,
      [orderId]
    );

    if (!parentResult.rowCount) {
      throw new ApiError(
        404,
        "ORDER_NOT_FOUND",
        "Parent order not found."
      );
    }

    const parent = parentResult.rows[0];

    // Then lock this seller's order.
    const sellerResult = await client.query(
      `SELECT id, status
       FROM seller_orders
       WHERE id = $1
         AND seller_id = $2
         AND order_id = $3
       FOR UPDATE`,
      [sellerOrderId, sellerId, orderId]
    );

    if (!sellerResult.rowCount) {
      throw new ApiError(
        404,
        "SELLER_ORDER_NOT_FOUND",
        "Seller order not found."
      );
    }

    const currentStatus = sellerResult.rows[0].status;

    // A pending or cancelled parent is never eligible.
    if (![
      "CONFIRMED",
      "PROCESSING",
      "SHIPPED",
      "DELIVERED"
    ].includes(parent.status)) {
      throw new ApiError(
        409,
        "ORDER_NOT_READY",
        "The parent order is not eligible for fulfillment."
      );
    }

    // A payment row must show successful payment
    // of the full order amount.
    const paymentResult = await client.query(
      `SELECT
         EXISTS (
           SELECT 1
           FROM payments
           WHERE order_id = $1
             AND status = 'PAID'
             AND amount = $2
         ) AS is_paid,
         EXISTS (
           SELECT 1
           FROM payments
           WHERE order_id = $1
             AND status IN ('REFUNDED', 'CANCELLED')
         ) AS has_reversal`,
      [orderId, parent.total_amount]
    );

    const payment = paymentResult.rows[0];

    if (!payment.is_paid || payment.has_reversal) {
      throw new ApiError(
        409,
        "PAYMENT_NOT_VERIFIED",
        "Verified payment is required before fulfillment."
      );
    }

    // Only permit the next step in the workflow.
    if (transitions[currentStatus] !== nextStatus) {
      throw new ApiError(
        409,
        "INVALID_STATUS_TRANSITION",
        `Cannot change ${currentStatus} to ${nextStatus}.`
      );
    }

    const updated = await repository.updateSellerOrderStatus(
      client,
      sellerOrderId,
      sellerId,
      nextStatus
    );

    if (!updated) {
      throw new Error("Seller order update failed.");
    }

    await client.query("COMMIT");

    return {
      ...updated,
      previous_status: currentStatus
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Seller status rollback failed:",
        rollbackError.message
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getSellerOrders,
  getSellerOrderDetails,
  getSellerOrderStatus,
  updateStatus
};
