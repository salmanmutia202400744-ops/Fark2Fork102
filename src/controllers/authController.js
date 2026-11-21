
const authService = require("../services/authService");

async function register(req, res, next) {
  try {
    const data = await authService.register(req.body);

    res.status(201).json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function login(req, res, next) {
  try {
    const data = await authService.login(req.body);

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function refresh(req, res, next) {
  try {
    const data = await authService.refresh(
      req.body.refreshToken
    );

    res.json({
      success: true,
      data
    });
  } catch (error) {
    next(error);
  }
}

async function logout(req, res, next) {
  try {
    await authService.logout(
      req.body.refreshToken,
      req.user.id
    );

    res.json({
      success: true,
      data: {
        message: "Logged out successfully."
      }
    });
  } catch (error) {
    next(error);
  }
}

function me(req, res) {
  res.json({
    success: true,
    data: req.user
  });
}

module.exports = {
  register,
  login,
  refresh,
  logout,
  me
};
