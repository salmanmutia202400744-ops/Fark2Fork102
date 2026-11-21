
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

module.exports = {
  getSellerOrders,
  getSellerOrderDetails,
  getSellerOrderStatus
};
