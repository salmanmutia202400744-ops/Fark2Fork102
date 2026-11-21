
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/environment");

function createAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      type: "access"
    },
    env.JWT_SECRET,
    {
      expiresIn: env.ACCESS_TOKEN_EXPIRES_IN
    }
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      type: "refresh",
      jti: crypto.randomUUID()
    },
    env.JWT_REFRESH_SECRET,
    {
      expiresIn: env.REFRESH_TOKEN_EXPIRES_IN
    }
  );
}

function hashToken(token) {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

module.exports = {
  createAccessToken,
  createRefreshToken,
  hashToken
};
