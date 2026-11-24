
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
      message: err.message,
      cause: err.cause?.message || null,
      code: err.cause?.code || null,
      name: err.name
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
      contentType: response.headers.get("content-type"),
      providerCode: result.code || null,
      providerMessage: result.message || null,
      retryAfter: response.headers.get("retry-after")
    });

    const error = new Error(
      `Maya request failed with status ${response.status}`
    );

    error.status = 502;
    error.statusCode = 502;
    error.providerStatus = response.status;
    error.providerCode = result.code || null;
    error.code =
      response.status === 401 || response.status === 403
        ? "MAYA_AUTH_ERROR"
        : "MAYA_API_ERROR";

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


async function getMayaPaymentByReference(orderId) {
  if (
    typeof orderId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)
  ) {
    throw new Error("Valid order ID is required.");
  }

  return mayaRequest(
    `/payments/v1/payment-rrns/${encodeURIComponent(orderId)}`,
    "GET",
    undefined,
    process.env.MAYA_SECRET_KEY
  );
}

async function getMayaPaymentStatus(paymentId) {
  if (
    typeof paymentId !== "string" ||
    !/^[0-9a-z-]{1,128}$/i.test(paymentId)
  ) {
    throw new Error("Valid Maya payment ID is required.");
  }

  return mayaRequest(
    `/payments/v1/payments/${encodeURIComponent(paymentId)}/status`,
    "GET",
    undefined,
    process.env.MAYA_PUBLIC_KEY
  );
}


module.exports = {
  createMayaCheckout,
  getMayaPayment,
  getMayaPaymentByReference,
  getMayaPaymentStatus
};