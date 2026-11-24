const db = require("../config/database");

// Available marketplace products
async function getMarketProducts() {
  const result = await db.query(`
    SELECT
      p.id,
      p.name,
      p.price,
      p.unit,
      p.stock_quantity,
      p.minimum_order_quantity,
      p.origin,
      c.name AS category_name,
      s.store_name AS seller_name,

      (
        SELECT image_url
        FROM public.product_images
        WHERE product_id = p.id
        ORDER BY is_primary DESC NULLS LAST, created_at
        LIMIT 1
      ) AS image_url

    FROM public.products p

    LEFT JOIN public.categories c
      ON c.id = p.category_id

    JOIN public.seller_profiles s
      ON s.id = p.seller_id

    WHERE p.status = 'ACTIVE'
      AND p.stock_quantity > 0
      AND p.stock_quantity >= p.minimum_order_quantity
      AND s.verification_status = 'APPROVED'
      AND (
        p.expiry_date IS NULL
        OR p.expiry_date >= CURRENT_DATE
      )

    ORDER BY p.name
    LIMIT 200
  `);

  return result.rows;
}

// Create conversation
async function createConversation(userId, title) {
  const result = await db.query(
    `INSERT INTO public.ai_conversations
      (user_id, title)
     VALUES ($1, $2)
     RETURNING *`,
    [userId, title]
  );

  return result.rows[0];
}

// Get user's conversations
async function getConversations(userId) {
  const result = await db.query(
    `SELECT *
     FROM public.ai_conversations
     WHERE user_id = $1
     ORDER BY updated_at DESC`,
    [userId]
  );

  return result.rows;
}

// Check conversation ownership
async function getConversation(id, userId) {
  const result = await db.query(
    `SELECT *
     FROM public.ai_conversations
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  return result.rows[0] || null;
}

// Retrieve conversation messages
async function getMessages(id, userId) {
  const result = await db.query(
    `SELECT m.*
     FROM public.ai_messages m
     JOIN public.ai_conversations c
       ON c.id = m.conversation_id
     WHERE c.id = $1
       AND c.user_id = $2
     ORDER BY m.created_at, m.id`,
    [id, userId]
  );

  return result.rows;
}

// Save conversation message
async function saveMessage(
  conversationId,
  userId,
  role,
  content,
  metadata = {}
) {
  return db.withTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO public.ai_messages
        (conversation_id, role, content, metadata)
       SELECT id, $3, $4, $5::jsonb
       FROM public.ai_conversations
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [
        conversationId,
        userId,
        role,
        content,
        JSON.stringify(metadata)
      ]
    );

    if (!result.rowCount) {
      throw new Error("Conversation not found.");
    }

    await client.query(
      `UPDATE public.ai_conversations
       SET updated_at = NOW()
       WHERE id = $1 AND user_id = $2`,
      [conversationId, userId]
    );

    return result.rows[0];
  });
}

// Delete conversation
async function deleteConversation(id, userId) {
  const result = await db.query(
    `DELETE FROM public.ai_conversations
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  return result.rowCount > 0;
}

// Save recipe
async function saveRecipe(userId, recipe) {
  const result = await db.query(
    `INSERT INTO public.saved_recipes (
      user_id,
      title,
      description,
      servings,
      cooking_minutes,
      ingredients,
      instructions,
      estimated_cost
    )
    VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)
    RETURNING *`,
    [
      userId,
      recipe.title,
      recipe.description,
      recipe.servings,
      recipe.cooking_minutes,
      JSON.stringify(recipe.ingredients),
      JSON.stringify(recipe.instructions),
      recipe.estimated_cost ?? null
    ]
  );

  return result.rows[0];
}

// Get recipe book
async function getRecipes(userId) {
  const result = await db.query(
    `SELECT *
     FROM public.saved_recipes
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

// Delete saved recipe
async function deleteRecipe(id, userId) {
  const result = await db.query(
    `DELETE FROM public.saved_recipes
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );

  return result.rowCount > 0;
}

// Record AI usage without duplicating private chat text
async function logInteraction(userId, model, usage) {
  await db.query(
    `INSERT INTO public.ai_interaction_logs (
      user_id,
      model_name,
      interaction_type,
      input_tokens,
      output_tokens,
      status
    )
    VALUES ($1,$2,$3,$4,$5,'SUCCESS')`,
    [
      userId,
      model,
      "CHAT",
      usage.inputTokens,
      usage.outputTokens
    ]
  );
}

module.exports = {
  getMarketProducts,
  createConversation,
  getConversations,
  getConversation,
  getMessages,
  saveMessage,
  deleteConversation,
  saveRecipe,
  getRecipes,
  deleteRecipe,
  logInteraction
};