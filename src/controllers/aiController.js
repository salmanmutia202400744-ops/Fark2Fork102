const { z } = require("zod");

const aiService = require("../services/aiService");
const repository = require("../repositories/aiRepository");
const inventory = require("../services/inventoryService");
const ApiError = require("../utils/ApiError");

const uuidSchema = z.string().uuid();

function validateId(id) {
  if (!uuidSchema.safeParse(id).success) {
    throw new ApiError(
      400,
      "INVALID_ID",
      "A valid ID is required."
    );
  }

  return id;
}

// Send message
async function chat(req, res, next) {
  try {
    const schema = z.object({
      message: z.string().trim().min(1).max(2000),
      conversation_id: z.string().uuid().optional()
    });

    const result = schema.safeParse(req.body);

    if (!result.success) {
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        "Please enter a valid message."
      );
    }

    const data = await aiService.chat(
      req.user,
      result.data.message,
      result.data.conversation_id
    );

    res.json({
      success: true,
      data
    });

  } catch (error) {
    next(error);
  }
}

// Get conversations
async function conversations(req, res, next) {
  try {
    const data = await repository.getConversations(
      req.user.id
    );

    res.json({ success: true, data });

  } catch (error) {
    next(error);
  }
}

// Get conversation messages
async function messages(req, res, next) {
  try {
    const id = validateId(req.params.id);

    const conversation = await repository.getConversation(
      id,
      req.user.id
    );

    if (!conversation) {
      throw new ApiError(
        404,
        "CHAT_NOT_FOUND",
        "Conversation not found."
      );
    }

    const data = await repository.getMessages(
      id,
      req.user.id
    );

    res.json({ success: true, data });

  } catch (error) {
    next(error);
  }
}

// Delete conversation
async function removeConversation(req, res, next) {
  try {
    const deleted = await repository.deleteConversation(
      validateId(req.params.id),
      req.user.id
    );

    if (!deleted) {
      throw new ApiError(
        404,
        "CHAT_NOT_FOUND",
        "Conversation not found."
      );
    }

    res.json({
      success: true,
      message: "Conversation deleted."
    });

  } catch (error) {
    next(error);
  }
}

// Save recipe
async function saveRecipe(req, res, next) {
  try {
    const result = aiService.recipeSchema.safeParse(
      req.body
    );

    if (!result.success) {
      throw new ApiError(
        422,
        "INVALID_RECIPE",
        "Recipe information is incomplete."
      );
    }

    const data = await repository.saveRecipe(
      req.user.id,
      result.data
    );

    res.status(201).json({
      success: true,
      data
    });

  } catch (error) {
    next(error);
  }
}

// Get recipe book
async function recipes(req, res, next) {
  try {
    const data = await repository.getRecipes(
      req.user.id
    );

    res.json({ success: true, data });

  } catch (error) {
    next(error);
  }
}

// Delete saved recipe
async function removeRecipe(req, res, next) {
  try {
    const deleted = await repository.deleteRecipe(
      validateId(req.params.id),
      req.user.id
    );

    if (!deleted) {
      throw new ApiError(
        404,
        "RECIPE_NOT_FOUND",
        "Recipe not found."
      );
    }

    res.json({
      success: true,
      message: "Recipe deleted."
    });

  } catch (error) {
    next(error);
  }
}

// Farmer confirms actual stock received
async function restock(req, res, next) {
  try {
    const schema = z.object({
      product_id: z.string().uuid(),

      quantity: z.number()
        .int()
        .positive()
        .max(10000),

      confirmed: z.literal(true)
    });

    const result = schema.safeParse(req.body);

    if (!result.success) {
      throw new ApiError(
        422,
        "INVALID_RESTOCK",
        "Confirm the actual quantity received."
      );
    }

    const data = await inventory.adjustStock(
      result.data.product_id,
      req.user,
      {
        change: result.data.quantity,
        reason: "Farmer-confirmed AI-assisted restock"
      }
    );

    res.json({
      success: true,
      message: "Stock updated successfully.",
      data
    });

  } catch (error) {
    next(error);
  }
}

module.exports = {
  chat,
  conversations,
  messages,
  removeConversation,
  saveRecipe,
  recipes,
  removeRecipe,
  restock
};