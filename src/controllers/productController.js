
const catalog = require("../services/catalogService");

const handle = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res)).catch(next);

const categories = handle(async (req, res) => {
  res.json({
    success: true,
    data: await catalog.listCategories()
  });
});

const list = handle(async (req, res) => {
  const result = await catalog.listProducts(req.query);

  res.json({
    success: true,
    ...result
  });
});

const detail = handle(async (req, res) => {
  res.json({
    success: true,
    data: await catalog.getProduct(req.params.id)
  });
});

const create = handle(async (req, res) => {
  const product = await catalog.createProduct(
    req.body,
    req.user
  );

  res.status(201).json({
    success: true,
    data: product
  });
});

const update = handle(async (req, res) => {
  res.json({
    success: true,
    data: await catalog.updateProduct(
      req.params.id,
      req.body,
      req.user
    )
  });
});

const remove = handle(async (req, res) => {
  res.json({
    success: true,
    data: await catalog.archiveProduct(
      req.params.id,
      req.user
    )
  });
});

const addImage = handle(async (req, res) => {
  const image = await catalog.addImage(
    req.params.id,
    req.body.image_url,
    req.user
  );

  res.status(201).json({
    success: true,
    data: image
  });
});

const deleteImage = handle(async (req, res) => {
  res.json({
    success: true,
    data: await catalog.deleteImage(
      req.params.id,
      req.params.imageId,
      req.user
    )
  });
});

const ownProducts = handle(async (req, res) => {
  res.json({
    success: true,
    data: await catalog.listOwnProducts(req.user)
  });
});

module.exports = {
  categories,
  list,
  detail,
  create,
  update,
  remove,
  addImage,
  deleteImage,
  ownProducts
};
