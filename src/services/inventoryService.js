
const db = require("../config/database");
const catalog = require("./catalogService");
const ApiError = require("../utils/ApiError");

async function adjustStock(productId, user, data) {
  await catalog.getAuthorizedProduct(productId, user);

  return db.withTransaction(async (client) => {
    const productResult = await client.query(
      `SELECT id, stock_quantity
       FROM public.products
       WHERE id = $1
       FOR UPDATE`,
      [productId]
    );

    if (!productResult.rowCount) {
      throw new ApiError(
        404,
        "PRODUCT_NOT_FOUND",
        "Product not found."
      );
    }

    const previous = productResult.rows[0].stock_quantity;
    const next = previous + data.change;

    if (next < 0) {
      throw new ApiError(
        409,
        "INSUFFICIENT_STOCK",
        "Stock cannot become negative."
      );
    }

    const enumResult = await client.query(`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_attribute a ON a.atttypid = t.oid
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relname = 'inventory_transactions'
        AND a.attname = 'transaction_type'
      ORDER BY e.enumsortorder
    `);

    const labels = enumResult.rows.map(
      (row) => row.enumlabel
    );

    const candidates = data.change > 0
      ? ["RESTOCK", "STOCK_IN", "IN", "ADJUSTMENT"]
      : ["STOCK_OUT", "OUT", "ADJUSTMENT"];

    const transactionType = candidates.find(
      (type) => labels.includes(type)
    );

    if (!transactionType) {
      throw new ApiError(
        409,
        "INVENTORY_ENUM_CONFIGURATION",
        "Inventory enum needs a compatible adjustment type.",
        { allowedTypes: labels }
      );
    }

    await client.query(
      `UPDATE public.products
       SET stock_quantity = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [next, productId]
    );

    await client.query(
      `INSERT INTO public.inventory_transactions (
        product_id, user_id, transaction_type,
        quantity, previous_quantity,
        new_quantity, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        productId,
        user.id,
        transactionType,
        Math.abs(data.change),
        previous,
        next,
        data.reason
      ]
    );

    return {
      product_id: productId,
      previous_quantity: previous,
      new_quantity: next,
      change: data.change,
      reason: data.reason
    };
  });
}

module.exports = { adjustStock };
