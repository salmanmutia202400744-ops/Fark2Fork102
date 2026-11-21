
const jwt = require("jsonwebtoken");

const env = require("../config/environment");
const users = require("../repositories/userRepository");
const ApiError = require("../utils/ApiError");

async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
      throw new ApiError(
        401,
        "UNAUTHENTICATED",
        "An access token is required."
      );
    }

    const token = authorization.slice(7);

    let payload;

    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new ApiError(
        401,
        "INVALID_TOKEN",
        "Access token is invalid or expired."
      );
    }

    if (payload.type !== "access") {
      throw new ApiError(
        401,
        "INVALID_TOKEN",
        "Invalid token type."
      );
    }

    const user = await users.findById(payload.sub);

    if (!user || !user.is_active) {
      throw new ApiError(
        401,
        "INVALID_SESSION",
        "Account is unavailable."
      );
    }

    req.user = user;

    next();
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(
        new ApiError(
          401,
          "UNAUTHENTICATED",
          "Authentication is required."
        )
      );
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          "FORBIDDEN",
          "You do not have permission."
        )
      );
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
