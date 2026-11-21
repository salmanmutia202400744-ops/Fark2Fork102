
const { pool, query } = require("../config/database");

async function findAll(userId) {
  const result = await query(
    `SELECT * FROM addresses
     WHERE user_id = $1
     ORDER BY is_default DESC, created_at DESC`,
    [userId]
  );

  return result.rows;
}

async function findById(id, userId) {
  const result = await query(
    `SELECT * FROM addresses
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  return result.rows[0] || null;
}

async function create(userId, data) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Serialize address changes for this customer.
    await client.query(
      "SELECT id FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    const count = await client.query(
      "SELECT COUNT(*)::integer AS total FROM addresses WHERE user_id = $1",
      [userId]
    );

    const makeDefault = data.is_default === true ||
      count.rows[0].total === 0;

    if (makeDefault) {
      await client.query(
        "UPDATE addresses SET is_default = false WHERE user_id = $1",
        [userId]
      );
    }

    const result = await client.query(
      `INSERT INTO addresses
       (user_id, recipient, phone, street, barangay,
        city, province, postal_code, country, is_default)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        userId,
        data.recipient,
        data.phone,
        data.street,
        data.barangay,
        data.city,
        data.province,
        data.postal_code,
        data.country,
        makeDefault
      ]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function update(id, userId, data) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT id FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    const existing = await client.query(
      "SELECT * FROM addresses WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [id, userId]
    );

    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }

    const makeDefault = data.is_default === true;

    if (makeDefault) {
      await client.query(
        "UPDATE addresses SET is_default = false WHERE user_id = $1",
        [userId]
      );
    }

    const result = await client.query(
      `UPDATE addresses
       SET recipient = $1,
           phone = $2,
           street = $3,
           barangay = $4,
           city = $5,
           province = $6,
           postal_code = $7,
           country = $8,
           is_default = $9
       WHERE id = $10 AND user_id = $11
       RETURNING *`,
      [
        data.recipient,
        data.phone,
        data.street,
        data.barangay,
        data.city,
        data.province,
        data.postal_code,
        data.country,
        makeDefault || existing.rows[0].is_default,
        id,
        userId
      ]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function remove(id, userId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT id FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    const existing = await client.query(
      "SELECT * FROM addresses WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [id, userId]
    );

    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }

    // Orders may reference an address.
    // The database can reject deletion if it is still referenced.
    await client.query(
      "DELETE FROM addresses WHERE id = $1 AND user_id = $2",
      [id, userId]
    );

    if (existing.rows[0].is_default) {
      await client.query(
        `UPDATE addresses
         SET is_default = true
         WHERE id = (
           SELECT id FROM addresses
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT 1
         )`,
        [userId]
      );
    }

    await client.query("COMMIT");
    return existing.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function setDefault(id, userId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT id FROM users WHERE id = $1 FOR UPDATE",
      [userId]
    );

    const existing = await client.query(
      "SELECT id FROM addresses WHERE id = $1 AND user_id = $2 FOR UPDATE",
      [id, userId]
    );

    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      "UPDATE addresses SET is_default = false WHERE user_id = $1",
      [userId]
    );

    const result = await client.query(
      `UPDATE addresses SET is_default = true
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  findAll,
  findById,
  create,
  update,
  remove,
  setDefault
};
