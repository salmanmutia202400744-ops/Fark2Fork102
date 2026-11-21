
const crypto = require("crypto");
const ApiError = require("../utils/ApiError");

function requestId(req, res, next) {
  req.requestId = crypto.randomUUID();

  res.setHeader("X-Request-Id", req.requestId);

  next();
}

function notFound(req, res, next) {
  next(
    new ApiError(
      404,
      "NOT_FOUND",
      "The requested resource was not found."
    )
  );
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  const status = error.status || 500;

  const code = error.code && status < 500
    ? error.code
    : "INTERNAL_SERVER_ERROR";

  const message = status >= 500
    ? "An unexpected server error occurred."
    : error.message;

  if (status >= 500) {
    console.error({
      requestId: req.requestId,
      message: error.message
    });
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details: error.details || null
    },
    requestId: req.requestId
  });
}

module.exports = {
  requestId,
  notFound,
  errorHandler
};
