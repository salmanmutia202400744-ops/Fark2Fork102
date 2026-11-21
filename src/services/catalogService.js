
const db = require("../config/database");
const repository = require("../repositories/productRepository");
const ApiError = require("../utils/ApiError");

async function listCategories() {
  return repository.getCategories();
}

async function listProducts(filters) {
  const result = await repository.findProducts(filters);

  return {
    data: result.products,
    meta: {
      page: filters.page,
      limit: filters.limit,
      total: result.total,
      totalPages: Math.ceil(
        result.total / filters.limit
      )
    }
  };
}

async function getProduct(id) {
  const product = await repository.findById(id);

  if (!product) {
    throw new ApiError(
      404,
      "PRODUCT_NOT_FOUND",
      "Product not found."
    );
  }

  return product;
}

async function getAuthorizedProduct(id, user) {
  const product = await repository.findById(id, true);

  if (!product) {
    throw new ApiError(
      404,
      "PRODUCT_NOT_FOUND",
      "Product not found."
    );
  }

  if (user.role === "ADMIN") {
    return product;
  }

  if (user.role !== "SELLER") {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Only sellers or administrators can manage products."
    );
  }

  const seller = await repository.getSellerProfile(user.id);

  if (!seller || seller.id !== product.seller_id) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "You cannot manage another seller's product."
    );
  }

  return product;
}

async function resolveSeller(user, requestedSellerId) {
  if (user.role === "ADMIN") {
    if (!requestedSellerId) {
      throw new ApiError(
        422,
        "SELLER_REQUIRED",
        "An administrator must provide a seller_id."
      );
    }

    const result = await db.query(
      `SELECT id
       FROM public.seller_profiles
       WHERE id = $1`,
      [requestedSellerId]
    );

    if (!result.rowCount) {
      throw new ApiError(
        404,
        "SELLER_NOT_FOUND",
        "Seller profile not found."
      );
    }

    return requestedSellerId;
  }

  if (user.role !== "SELLER") {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Seller access is required."
    );
  }

  const seller = await repository.getSellerProfile(user.id);

  if (!seller || seller.verification_status !== "APPROVED") {
    throw new ApiError(
      403,
      "SELLER_NOT_APPROVED",
      "Your seller account is not approved."
    );
  }

  return seller.id;
}

async function createProduct(data, user) {
  const sellerId = await resolveSeller(
    user,
    data.seller_id
  );

  const created = await db.withTransaction(async (client) => {
    const product = await repository.createProduct(client, {
      ...data,
      seller_id: sellerId
    });

    if (data.image_url) {
      await client.query(
        `INSERT INTO public.product_images
         (product_id, image_url, is_primary)
         VALUES ($1, $2, true)`,
        [product.id, data.image_url]
      );
    }

    return product;
  });

  return repository.findById(created.id, true);
}

async function updateProduct(id, data, user) {
  await getAuthorizedProduct(id, user);

  const allowedFields = [
    "category_id",
    "name",
    "description",
    "price",
    "unit",
    "status",
    "origin",
    "harvest_date",
    "expiry_date",
    "is_organic",
    "minimum_order_quantity"
  ];

  const fields = [];
  const values = [];

  for (const key of allowedFields) {
    if (data[key] !== undefined) {
      values.push(data[key]);
      fields.push(`${key} = $${values.length}`);
    }
  }

  if (!fields.length) {
    throw new ApiError(
      422,
      "NO_CHANGES",
      "No valid product changes were provided."
    );
  }

  values.push(id);

  await db.query(
    `UPDATE public.products
     SET ${fields.join(", ")},
         updated_at = NOW()
     WHERE id = $${values.length}`,
    values
  );

  return repository.findById(id, true);
}

async function archiveProduct(id, user) {
  await getAuthorizedProduct(id, user);

  await db.query(
    `UPDATE public.products
     SET status = 'ARCHIVED',
         updated_at = NOW()
     WHERE id = $1`,
    [id]
  );

  return {
    message: "Product archived successfully."
  };
}

async function addImage(id, imageUrl, user) {
  await getAuthorizedProduct(id, user);

  const result = await db.withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT id
       FROM public.product_images
       WHERE product_id = $1
       LIMIT 1`,
      [id]
    );

    return client.query(
      `INSERT INTO public.product_images
       (product_id, image_url, is_primary)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, imageUrl, existing.rowCount === 0]
    );
  });

  return result.rows[0];
}

async function deleteImage(id, imageId, user) {
  await getAuthorizedProduct(id, user);

  const result = await db.withTransaction(async (client) => {
    const deleted = await client.query(
      `DELETE FROM public.product_images
       WHERE id = $1 AND product_id = $2
       RETURNING *`,
      [imageId, id]
    );

    if (!deleted.rowCount) {
      throw new ApiError(
        404,
        "IMAGE_NOT_FOUND",
        "Product image not found."
      );
    }

    if (deleted.rows[0].is_primary) {
      const next = await client.query(
        `SELECT id
         FROM public.product_images
         WHERE product_id = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [id]
      );

      if (next.rowCount) {
        await client.query(
          `UPDATE public.product_images
           SET is_primary = true
           WHERE id = $1`,
          [next.rows[0].id]
        );
      }
    }

    return deleted.rows[0];
  });

  return result;
}

async function listOwnProducts(user) {
  if (user.role !== "SELLER") {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Seller access is required."
    );
  }

  const seller = await repository.getSellerProfile(user.id);

  if (!seller) {
    throw new ApiError(
      404,
      "SELLER_PROFILE_NOT_FOUND",
      "Seller profile not found."
    );
  }

  return repository.listSellerProducts(seller.id);
}

module.exports = {
  listCategories,
  listProducts,
  getProduct,
  createProduct,
  updateProduct,
  archiveProduct,
  addImage,
  deleteImage,
  listOwnProducts,
  getAuthorizedProduct
};
