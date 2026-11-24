
const { z } = require("zod");

const service = require(
  "../services/aiAnalyticsService"
);

const ApiError = require("../utils/ApiError");

async function analytics(req, res, next) {
  try {
    const schema = z.coerce.number()
      .int()
      .min(1)
      .max(365);

    const result = schema.safeParse(
      req.query.days ?? 30
    );

    if (!result.success) {
      throw new ApiError(
        422,
        "INVALID_PERIOD",
        "Days must be between 1 and 365."
      );
    }

    const data = await service.getAnalytics(
      req.user.id,
      result.data
    );

    res.json({
      success: true,
      data
    });

  } catch (error) {
    next(error);
  }
}

async function inventory(req, res, next) {
  try {
    const data = await service.getInventory(
      req.user.id
    );

    res.json({
      success: true,
      data
    });

  } catch (error) {
    next(error);
  }
}

module.exports = {
  analytics,
  inventory
};
