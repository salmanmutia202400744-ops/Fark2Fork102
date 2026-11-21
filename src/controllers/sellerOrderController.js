
const service = require("../services/sellerOrderService");
const ApiError = require("../utils/ApiError");

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateId(id) {
  if (!UUID_REGEX.test(id)) {
    throw new ApiError(
      400,
      "INVALID_SELLER_ORDER_ID",
      "A valid seller order ID is required."
    );
  }
}

// GET /api/v1/seller/orders
async function listOrders(req, res, next) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

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
        "Invalid page or limit."
      );
    }

    const result = await service.getSellerOrders(
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

// GET /api/v1/seller/orders/:id
async function getOrder(req, res, next) {
  try {
    validateId(req.params.id);

    const result = await service.getSellerOrderDetails(
      req.params.id,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/v1/seller/orders/:id/status
async function getStatus(req, res, next) {
  try {
    validateId(req.params.id);

    const result = await service.getSellerOrderStatus(
      req.params.id,
      req.user.id
    );

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listOrders,
  getOrder,
  getStatus
};
