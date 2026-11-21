if (!response.ok) {
  console.error("Maya Sandbox Error:", {
    endpoint: path,
    status: response.status,
    providerCode: result.code || null,
    providerMessage: result.message || null
  });

  const error = new Error(
    `Maya request failed with status ${response.status}`
  );

  error.status = 502;
  error.statusCode = 502;
  error.code = "MAYA_API_ERROR";

  throw error;
}