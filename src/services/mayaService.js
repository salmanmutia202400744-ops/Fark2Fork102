
const MAYA_BASE_URL =
  process.env.MAYA_BASE_URL ||
  "https://pg-sandbox.paymaya.com";

function getBasicAuth(key) {
  return (
    "Basic " +
    Buffer.from(`${key}:`).toString("base64")
  );
}

async function mayaRequest(path, method, body, key) {
  if (!key) {
    const error = new Error(
      "Maya Sandbox API key is missing."
    );
    error.status = 500;
    throw error;
  }

  const url = `${MAYA_BASE_URL}${path}`;

  let response;

  try {
    response = await fetch(url, {
      method,
      headers: {
        Authorization: getBasicAuth(key),
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      ...(body !== undefined
        ? { body: JSON.stringify(body) }
        : {}),
      signal: AbortSignal.timeout(15000)
    });
  } catch (err) {
    console.error("Maya Network Error:", {
      endpoint: path,
      message: err.message
    });

    const error = new Error(
      "Unable to connect to Maya Sandbox."
    );
    error.status = 502;
    error.code = "MAYA_CONNECTION_ERROR";
    throw error;
  }

  const raw = await response.text();

  let result;

  try {
    result = raw ? JSON.parse(raw) : {};
  } catch {
    result = {};
  }

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

  return result;
}

async function createMayaCheckout(order) {
  const redirectBase =
    process.env.MAYA_REDIRECT_BASE_URL;

  if (!redirectBase) {
    throw new Error(
      "MAYA_REDIRECT_BASE_URL is missing."
    );
  }

  const payload = {
    totalAmount: {
      value: Number(order.total_amount),
      currency: "PHP"
    },
    requestReferenceNumber: order.id,
    redirectUrl: {
      success: `${redirectBase}/payment/success`,
      failure: `${redirectBase}/payment/failure`,
      cancel: `${redirectBase}/payment/cancel`
    }
  };

  return mayaRequest(
    "/checkout/v1/checkouts",
    "POST",
    payload,
    process.env.MAYA_PUBLIC_KEY
  );
}

async function getMayaPayment(paymentId) {
  return mayaRequest(
    `/payments/v1/payments/${encodeURIComponent(paymentId)}`,
    "GET",
    undefined,
    process.env.MAYA_SECRET_KEY
  );
}

module.exports = {
  createMayaCheckout,
  getMayaPayment
};
