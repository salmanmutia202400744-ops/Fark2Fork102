const { GoogleGenAI } = require("@google/genai");
const env = require("../config/environment");
const ApiError = require("../utils/ApiError");

async function generateAI(systemInstruction, contents) {
  if (!env.GEMINI_API_KEY) {
    throw new ApiError(
      503,
      "AI_NOT_CONFIGURED",
      "The AI assistant is currently unavailable."
    );
  }

  try {
    const ai = new GoogleGenAI({
      apiKey: env.GEMINI_API_KEY,
      httpOptions: {
        timeout: 20000
      }
    });

    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents,

      config: {
        systemInstruction,
        temperature: 0.4,
        maxOutputTokens: 4096,
        responseMimeType: "application/json"
      }
    });

    if (!response.text) {
      throw new Error("Empty AI response.");
    }

    return {
      data: JSON.parse(response.text),

      usage: {
        inputTokens:
          response.usageMetadata?.promptTokenCount || 0,

        outputTokens:
          response.usageMetadata?.candidatesTokenCount || 0
      }
    };

  } catch (error) {
    console.error("Gemini request failed:", error.name);

    throw new ApiError(
      503,
      "AI_UNAVAILABLE",
      "The AI assistant is temporarily unavailable."
    );
  }
}

module.exports = {
  generateAI
};