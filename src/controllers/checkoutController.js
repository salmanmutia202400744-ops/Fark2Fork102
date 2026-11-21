const { randomUUID } = require("node:crypto");
const {
  createCheckoutOrder
} = require("../services/checkoutService");

async function checkout(req, res, next) {
  try {
    const { address_id } = req.body;

    const key = req.get("Idempotency-Key");

    if (
      typeof address_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(address_id)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid address_id is required"
      });
    }

    if (
      !key ||
      key.length > 128 ||
      !/^[a-zA-Z0-9_-]+$/.test(key)
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid Idempotency-Key header is required"
      });
    }

    const order = await createCheckoutOrder(
      req.user.id,
      address_id,
      key
    );

    return res.status(order.already_created ? 200 : 201).json({
      success: true,
      data: order
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { checkout };