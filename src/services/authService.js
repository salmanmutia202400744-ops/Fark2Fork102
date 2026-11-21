
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const env = require("../config/environment");
const db = require("../config/database");
const users = require("../repositories/userRepository");
const ApiError = require("../utils/ApiError");

const {
  createAccessToken,
  createRefreshToken,
  hashToken
} = require("../utils/tokens");

async function createSession(user) {
  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  const payload = jwt.decode(refreshToken);

  await db.query(
    `INSERT INTO public.refresh_tokens
      (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [
      user.id,
      hashToken(refreshToken),
      new Date(payload.exp * 1000)
    ]
  );

  return {
    user,
    accessToken,
    refreshToken,
    tokenType: "Bearer"
  };
}

async function register(data) {
  const email = data.email.trim().toLowerCase();

  const existing = await users.findByEmail(email);

  if (existing) {
    throw new ApiError(
      409,
      "EMAIL_ALREADY_EXISTS",
      "An account with this email already exists."
    );
  }

  const passwordHash = await bcrypt.hash(
    data.password,
    12
  );

  let user;

  try {
    user = await db.withTransaction((client) =>
      users.createUser(client, {
        ...data,
        email,
        password_hash: passwordHash
      })
    );
  } catch (error) {
    if (error.code === "23505") {
      throw new ApiError(
        409,
        "EMAIL_ALREADY_EXISTS",
        "An account with this email already exists."
      );
    }

    throw error;
  }

  return createSession(user);
}

async function login(data) {
  const email = data.email.trim().toLowerCase();

  const user = await users.findByEmail(email);

  const validPassword = user
    ? await bcrypt.compare(
        data.password,
        user.password_hash
      )
    : false;

  if (!validPassword) {
    throw new ApiError(
      401,
      "INVALID_CREDENTIALS",
      "Invalid email or password."
    );
  }

  if (!user.is_active) {
    throw new ApiError(
      403,
      "ACCOUNT_DISABLED",
      "This account is disabled."
    );
  }

  const safeUser = await users.findById(user.id);

  return createSession(safeUser);
}

async function refresh(refreshToken) {
  let payload;

  try {
    payload = jwt.verify(
      refreshToken,
      env.JWT_REFRESH_SECRET
    );
  } catch {
    throw new ApiError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Refresh token is invalid or expired."
    );
  }

  if (payload.type !== "refresh") {
    throw new ApiError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Invalid token type."
    );
  }

  const tokenHash = hashToken(refreshToken);

  const result = await db.query(
    `UPDATE public.refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND token_hash = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()
     RETURNING id`,
    [payload.sub, tokenHash]
  );

  if (!result.rowCount) {
    throw new ApiError(
      401,
      "INVALID_REFRESH_TOKEN",
      "Refresh token has expired or was revoked."
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

  return createSession(user);
}

async function logout(refreshToken, userId) {
  await db.query(
    `UPDATE public.refresh_tokens
     SET revoked_at = NOW()
     WHERE user_id = $1
       AND token_hash = $2
       AND revoked_at IS NULL`,
    [userId, hashToken(refreshToken)]
  );
}

module.exports = {
  register,
  login,
  refresh,
  logout
};
