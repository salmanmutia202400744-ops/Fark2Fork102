
const { startMayaPayment } = require("../services/paymentService");

async function createCheckout(req, res, next) {
  try {
    const { order_id } = req.body;

    if (
      typeof order_id !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order_id)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid order_id is required"
      });
    }

    const payment = await startMayaPayment(
      req.user.id,
      order_id
    );

    return res.status(201).json({
      success: true,
      data: payment
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { createCheckout };
