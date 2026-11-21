
const cartService = require("../services/cartService");

async function get(req, res, next) {
  try {
    res.json({
      success: true,
      data: await cartService.getCart(req.user.id)
    });
  } catch (error) {
    next(error);
  }
}

async function add(req, res, next) {
  try {
    const cart = await cartService.addItem(
      req.user.id,
      req.body
    );

    res.status(201).json({
      success: true,
      data: cart
    });
  } catch (error) {
    next(error);
  }
}

async function update(req, res, next) {
  try {
    res.json({
      success: true,
      data: await cartService.updateItem(
        req.user.id,
        req.params.id,
        req.body.quantity
      )
    });
  } catch (error) {
    next(error);
  }
}

async function remove(req, res, next) {
  try {
    res.json({
      success: true,
      data: await cartService.removeItem(
        req.user.id,
        req.params.id
      )
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  get,
  add,
  update,
  remove
};
