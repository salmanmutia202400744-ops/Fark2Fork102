
const repository = require("../repositories/sellerOrderRepository");
const ApiError = require("../utils/ApiError");

// GET /api/v1/seller/orders
async function getSellerOrders(sellerId, page = 1, limit = 10) {
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
async function getSellerOrderDetails(sellerOrderId, sellerId) {
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
async function getSellerOrderStatus(sellerOrderId, sellerId) {
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
