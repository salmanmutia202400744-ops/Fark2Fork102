
const { GoogleGenAI } = require("@google/genai");
const env = require("../config/environment");
const ApiError = require("../utils/ApiError");

// Wait before retrying a failed request
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Retrieve the provider's HTTP status
function getErrorStatus(error) {
  return Number(
    error.status ||
    error.statusCode ||
    error.response?.status ||
    0
  );
}

// Check whether the error is temporary
function isRetryable(error) {
  const status = getErrorStatus(error);

  return (
    [500, 502, 503, 504].includes(status) ||
    ["ETIMEDOUT", "ECONNRESET"].includes(error.code)
  );
}

async function generateAI(systemInstruction, contents) {
  if (!env.GEMINI_API_KEY) {
    throw new ApiError(
      503,
      "AI_NOT_CONFIGURED",
      "The AI assistant is currently unavailable."
    );
  }

  const ai = new GoogleGenAI({
    apiKey: env.GEMINI_API_KEY,

    httpOptions: {
      timeout: 10000
    }
  });

  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(
        `Gemini request: attempt ${attempt}/${maxAttempts}`
      );

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
        throw new ApiError(
          502,
          "EMPTY_AI_RESPONSE",
          "The AI assistant returned an empty response."
        );
      }

      let data;

      try {
        data = JSON.parse(response.text);
      } catch {
        throw new ApiError(
          502,
          "INVALID_AI_RESPONSE",
          "The AI assistant returned an invalid response."
        );
      }

      console.log("Gemini request successful.");

      return {
        data,

        usage: {
          inputTokens:
            response.usageMetadata?.promptTokenCount || 0,

          outputTokens:
            response.usageMetadata?.candidatesTokenCount || 0
        }
      };

    } catch (error) {
      const status = getErrorStatus(error);

      console.error("Gemini request failed:", {
        attempt,
        status,
        name: error.name
      });

      if (error instanceof ApiError) {
        throw error;
      }

      // Do not repeatedly retry quota errors
      if (status === 429) {
        throw new ApiError(
          429,
          "AI_RATE_LIMIT",
          "The AI usage limit has been reached. Please try again later."
        );
      }

      // Retry temporary provider errors
      if (isRetryable(error) && attempt < maxAttempts) {
        const delay =
          1000 * Math.pow(2, attempt - 1) +
          Math.floor(Math.random() * 300);

        console.log(`Retrying Gemini in ${delay}ms`);

        await sleep(delay);
        continue;
      }

      throw new ApiError(
        503,
        "AI_UNAVAILABLE",
        "The AI assistant is temporarily unavailable."
      );
    }
  }
}

module.exports = {
  generateAI
};
