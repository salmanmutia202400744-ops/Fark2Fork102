
require("dotenv").config();

const {
  getMayaPaymentByReference
} = require("../services/mayaService");

async function main() {
  const orderId = process.argv[2];

  if (!orderId) {
    console.error(
      "Usage: node src/scripts/checkMayaPayment.js ORDER_UUID"
    );
    process.exitCode = 1;
    return;
  }

  try {
    const payment = await getMayaPaymentByReference(orderId);

    // Print selected non-sensitive fields only.
    console.log(JSON.stringify({
      id: payment.id ?? null,
      status: payment.status ?? null,
      paymentStatus: payment.paymentStatus ?? null,
      isPaid: payment.isPaid ?? null,
      amount: payment.amount ?? null,
      currency: payment.currency ?? null,
      requestReferenceNumber:
        payment.requestReferenceNumber ?? null
    }, null, 2));

    console.log(
      "Diagnostic only. No Farm2Fork records were updated."
    );
  } catch (error) {
    console.error("Maya lookup failed:", {
      code: error.code || "LOOKUP_ERROR",
      message: error.message
    });

    process.exitCode = 1;
  }
}

main();
