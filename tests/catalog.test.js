
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const app = require("../src/app");
const { pool } = require("../src/config/database");

test("GET categories returns success envelope", async () => {
  const response = await request(app)
    .get("/api/v1/categories");

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data));
});

test("GET products returns pagination metadata", async () => {
  const response = await request(app)
    .get("/api/v1/products?page=1&limit=5");

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.ok(Array.isArray(response.body.data));
  assert.equal(response.body.meta.page, 1);
  assert.equal(response.body.meta.limit, 5);
});

test("GET products rejects invalid pagination", async () => {
  const response = await request(app)
    .get("/api/v1/products?page=-1");

  assert.equal(response.status, 422);
  assert.equal(response.body.success, false);
  assert.equal(
    response.body.error.code,
    "VALIDATION_ERROR"
  );
});

test("GET cart requires authentication", async () => {
  const response = await request(app)
    .get("/api/v1/cart");

  assert.equal(response.status, 401);
  assert.equal(
    response.body.error.code,
    "UNAUTHENTICATED"
  );
});

test("POST products requires authentication", async () => {
  const response = await request(app)
    .post("/api/v1/products")
    .send({
      name: "Fresh Mango",
      price: 100,
      unit: "kg"
    });

  assert.equal(response.status, 401);
});

test.after(async () => {
  await pool.end();
});
