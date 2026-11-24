
const repository = require(
  "../repositories/aiAnalyticsRepository"
);

const ApiError = require("../utils/ApiError");

async function resolveSeller(userId) {
  const seller = await repository.getSeller(userId);

  if (!seller) {
    throw new ApiError(
      404,
      "SELLER_NOT_FOUND",
      "Seller profile not found."
    );
  }

  return seller;
}

function money(value) {
  return Math.round(Number(value) * 100) / 100;
}

// Sales analytics
async function getAnalytics(userId, days = 30) {
  const seller = await resolveSeller(userId);

  const [
    summary,
    topProducts,
    dailySales
  ] = await Promise.all([
    repository.getSalesSummary(seller.id, days),

    repository.getTopProducts(seller.id, days),

    repository.getDailySales(seller.id, days)
  ]);

  return {
    seller_id: seller.id,
    store_name: seller.store_name,
    period_days: days,
    currency: "PHP",

    summary: {
      total_orders: Number(summary.total_orders),

      delivered_orders:
        Number(summary.delivered_orders),

      product_revenue:
        money(summary.product_revenue),

      delivery_fees:
        money(summary.delivery_fees),

      total_revenue:
        money(summary.total_revenue)
    },

    top_products: topProducts.map((product) => ({
      ...product,
      quantity_sold: Number(product.quantity_sold),
      revenue: money(product.revenue)
    })),

    daily_sales: dailySales.map((day) => ({
      ...day,
      orders: Number(day.orders),
      revenue: money(day.revenue)
    }))
  };
}

// Smart inventory monitoring
async function getInventory(userId) {
  const seller = await resolveSeller(userId);

  const rows = await repository.getInventory(
    seller.id
  );

  const products = rows.map((product) => ({
    ...product,
    price: money(product.price),

    inventory_value:
      money(product.inventory_value),

    stock_quantity:
      Number(product.stock_quantity),

    minimum_order_quantity:
      Number(product.minimum_order_quantity)
  }));

  const outOfStock = products.filter(
    (p) => p.stock_status === "OUT_OF_STOCK"
  );

  const lowStock = products.filter(
    (p) =>
      p.stock_status === "LOW_STOCK" ||
      p.stock_status === "BELOW_MINIMUM"
  );

  const expired = products.filter(
    (p) => p.stock_status === "EXPIRED"
  );

  const expiringSoon = products.filter(
    (p) => p.expiring_soon
  );

  const restockSuggestions = [
    ...outOfStock,
    ...lowStock
  ]
    .filter((p) => !p.expiring_soon)
    .map((product) => {
      const target = Math.max(
        20,
        Math.ceil(product.minimum_order_quantity)
      );

      return {
        product_id: product.id,
        product_name: product.name,
        current_stock: product.stock_quantity,
        unit: product.unit,

        suggested_quantity: Math.max(
          0,
          target - product.stock_quantity
        ),

        reason:
          product.stock_status === "OUT_OF_STOCK"
            ? "Product is currently out of stock."
            : "Product stock is below the recommended level.",

        method: "RULE_BASED"
      };
    })
    .filter((p) => p.suggested_quantity > 0);

  return {
    seller_id: seller.id,
    store_name: seller.store_name,

    summary: {
      total_products: products.length,

      healthy_products: products.filter(
        (p) => p.stock_status === "HEALTHY"
      ).length,

      out_of_stock: outOfStock.length,
      low_stock: lowStock.length,
      expired_products: expired.length,
      expiring_soon: expiringSoon.length,

      inventory_value: money(
        products.reduce(
          (sum, p) => sum + p.inventory_value,
          0
        )
      )
    },

    products,
    out_of_stock: outOfStock,
    low_stock: lowStock,
    expired_products: expired,
    expiring_soon: expiringSoon,

    restock_suggestions: restockSuggestions
  };
}

module.exports = {
  getAnalytics,
  getInventory
};
