
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

  const status = error.statusCode || error.status || 500;

  const code =
    typeof error.code === "string"
      ? error.code
      : status >= 500
        ? "INTERNAL_SERVER_ERROR"
        : "REQUEST_FAILED";

  const publicAIErrors = {
  AI_UNAVAILABLE:
    "The AI assistant is temporarily busy. Please try again shortly.",

  AI_NOT_CONFIGURED:
    "The AI assistant is currently unavailable.",

  INVALID_AI_RESPONSE:
    "The assistant could not generate a valid response. Please try again.",

  EMPTY_AI_RESPONSE:
    "The assistant returned an empty response. Please try again."
};

const message =
  status >= 500
    ? (
        Object.prototype.hasOwnProperty.call(
          publicAIErrors,
          code
        )
          ? publicAIErrors[code]
          : "An unexpected server error occurred."
      )
    : error.message;

  // Log useful diagnostic information on the server only.
  if (status >= 500) {
    console.error("Farm2Fork API Error:", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      code,
      message: error.message,
      stack: error.stack
    });
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message,
      details: status >= 500 ? null : (error.details || null)
    },
    requestId: req.requestId
  });
}

module.exports = {
  requestId,
  notFound,
  errorHandler
};
