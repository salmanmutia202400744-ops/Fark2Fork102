
const { query } = require("../config/database");

const publicFields = `
  id, first_name, last_name, email,
  phone, role, is_active, is_verified,
  created_at
`;

async function findByEmail(email) {
  const result = await query(
    "SELECT * FROM public.users WHERE email = $1",
    [email]
  );

  return result.rows[0] || null;
}

async function findById(id) {
  const result = await query(
    `SELECT ${publicFields}
     FROM public.users
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] || null;
}

async function createUser(client, data) {
  const result = await client.query(
    `INSERT INTO public.users
      (first_name, last_name, email,
       password_hash, phone, role)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${publicFields}`,
    [
      data.first_name,
      data.last_name,
      data.email,
      data.password_hash,
      data.phone || null,
      "CUSTOMER"
    ]
  );

  return result.rows[0];
}

module.exports = {
  findByEmail,
  findById,
  createUser
};
