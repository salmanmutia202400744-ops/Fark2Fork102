
const service = require("../services/orderService");
const ApiError = require("../utils/ApiError");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateOrderId(id) {
  if (!UUID_REGEX.test(id)) {
    throw new ApiError(
      400,
      "INVALID_ORDER_ID",
      "A valid order ID is required."
    );
  }
}

async function listOrders(req, res, next) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);

    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(limit) ||
      limit < 1 ||
      limit > 50 ||
      (page - 1) * limit > 1000000
    ) {
      throw new ApiError(
        400,
        "INVALID_PAGINATION",
        "Page must be positive and limit must be between 1 and 50."
      );
    }

    const result = await service.getOrders(
      req.user.id,
      page,
      limit
    );

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

async function getOrder(req, res, next) {
  try {
    validateOrderId(req.params.id);

    const order = await service.getOrderDetails(
      req.params.id,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
}

async function getStatus(req, res, next) {
  try {
    validateOrderId(req.params.id);

    const status = await service.getOrderStatus(
      req.params.id,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    next(error);
  }
}

async function cancel(req, res, next) {
  try {
    validateOrderId(req.params.id);

    const order = await service.cancelOrder(
      req.params.id,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully.",
      data: order
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listOrders,
  getOrder,
  getStatus,
  cancel
};
