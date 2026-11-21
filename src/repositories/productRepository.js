
const db = require("../config/database");

const productFields = `
  p.id, p.seller_id, p.category_id,
  p.name, p.description, p.price,
  p.stock_quantity, p.unit, p.status,
  p.origin, p.harvest_date, p.expiry_date,
  p.is_organic, p.minimum_order_quantity,
  p.created_at, p.updated_at,
  c.name AS category_name,
  s.store_name AS seller_name,
  COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', pi.id,
          'image_url', pi.image_url,
          'is_primary', pi.is_primary
        )
        ORDER BY pi.is_primary DESC, pi.created_at
      )
      FROM public.product_images pi
      WHERE pi.product_id = p.id
    ),
    '[]'::jsonb
  ) AS images
`;

async function getCategories() {
  const result = await db.query(`
    SELECT id, name, description, parent_id
    FROM public.categories
    ORDER BY name ASC
  `);

  return result.rows;
}

async function findProducts(filters) {
  const {
    search, category, minPrice, maxPrice,
    sort, page, limit
  } = filters;

  const conditions = ["p.status = 'ACTIVE'"];
  const values = [];

  function add(value) {
    values.push(value);
    return `$${values.length}`;
  }

  if (search) {
    conditions.push(
      `p.name ILIKE ${add(`%${search}%`)}`
    );
  }

  if (category) {
    conditions.push(
      `p.category_id = ${add(category)}`
    );
  }

  if (minPrice !== undefined) {
    conditions.push(
      `p.price >= ${add(minPrice)}`
    );
  }

  if (maxPrice !== undefined) {
    conditions.push(
      `p.price <= ${add(maxPrice)}`
    );
  }

  const where = conditions.join(" AND ");

  const sortOptions = {
    newest: "p.created_at DESC",
    price_asc: "p.price ASC, p.id ASC",
    price_desc: "p.price DESC, p.id ASC",
    name: "p.name ASC, p.id ASC"
  };

  const orderBy = sortOptions[sort] || sortOptions.newest;

  const count = await db.query(
    `SELECT COUNT(*)::integer AS total
     FROM public.products p
     WHERE ${where}`,
    values
  );

  const offset = (page - 1) * limit;
  const limitParam = add(limit);
  const offsetParam = add(offset);

  const result = await db.query(
    `SELECT ${productFields}
     FROM public.products p
     LEFT JOIN public.categories c
       ON c.id = p.category_id
     JOIN public.seller_profiles s
       ON s.id = p.seller_id
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT ${limitParam}
     OFFSET ${offsetParam}`,
    values
  );

  return {
    products: result.rows,
    total: count.rows[0].total
  };
}

async function findById(id, includeInactive = false) {
  const result = await db.query(
    `SELECT ${productFields}
     FROM public.products p
     LEFT JOIN public.categories c
       ON c.id = p.category_id
     JOIN public.seller_profiles s
       ON s.id = p.seller_id
     WHERE p.id = $1
       ${includeInactive ? "" : "AND p.status = 'ACTIVE'"}`,
    [id]
  );

  return result.rows[0] || null;
}

async function getSellerProfile(userId) {
  const result = await db.query(
    `SELECT *
     FROM public.seller_profiles
     WHERE user_id = $1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function listSellerProducts(sellerId) {
  const result = await db.query(
    `SELECT ${productFields}
     FROM public.products p
     LEFT JOIN public.categories c
       ON c.id = p.category_id
     JOIN public.seller_profiles s
       ON s.id = p.seller_id
     WHERE p.seller_id = $1
     ORDER BY p.created_at DESC`,
    [sellerId]
  );

  return result.rows;
}

async function createProduct(client, data) {
  const result = await client.query(
    `INSERT INTO public.products (
      seller_id, category_id, name,
      description, price, stock_quantity,
      unit, status, origin, harvest_date,
      expiry_date, is_organic,
      minimum_order_quantity
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7,
      $8, $9, $10, $11, $12, $13
    )
    RETURNING id`,
    [
      data.seller_id,
      data.category_id || null,
      data.name,
      data.description || null,
      data.price,
      data.stock_quantity,
      data.unit,
      data.status || "DRAFT",
      data.origin || null,
      data.harvest_date || null,
      data.expiry_date || null,
      data.is_organic || false,
      data.minimum_order_quantity || 1
    ]
  );

  return result.rows[0];
}

module.exports = {
  getCategories,
  findProducts,
  findById,
  getSellerProfile,
  listSellerProducts,
  createProduct
};
