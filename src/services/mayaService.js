
const BASE_URL =
  process.env.MAYA_BASE_URL ||
  "https://pg-sandbox.paymaya.com";

async function mayaRequest(path, method, key, body) {
  if (!key) {
    const error = new Error("Maya API key is not configured");
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${key}:`).toString("base64"),
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000)
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      `Maya request failed with status ${response.status}`
    );
    error.status = 502;
    throw error;
  }

  return result;
}

async function createMayaCheckout(order) {
  const base = process.env.MAYA_REDIRECT_BASE_URL;

  if (!base) {
    const error = new Error("Maya redirect URL not configured");
    error.status = 503;
    throw error;
  }

  const url = base.replace(/\/$/, "");

  return mayaRequest(
    "/checkout/v1/checkouts",
    "POST",
    process.env.MAYA_PUBLIC_KEY,
    {
      totalAmount: {
        value: Number(order.total_amount),
        currency: "PHP"
      },
      requestReferenceNumber: order.id,
      redirectUrl: {
        success: `${url}/payment/success`,
        failure: `${url}/payment/failure`,
        cancel: `${url}/payment/cancel`
      }
    }
  );
}

async function getMayaPayment(paymentId) {
  return mayaRequest(
    `/payments/v1/payments/${encodeURIComponent(paymentId)}`,
    "GET",
    process.env.MAYA_SECRET_KEY
  );
}

module.exports = {
  createMayaCheckout,
  getMayaPayment
};
