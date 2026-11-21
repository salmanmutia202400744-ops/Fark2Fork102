
const addresses = require("../repositories/addressRepository");
const ApiError = require("../utils/ApiError");

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fields = [
  "recipient",
  "phone",
  "street",
  "barangay",
  "city",
  "province",
  "postal_code",
  "country"
];

function validateId(id) {
  if (!uuidPattern.test(id)) {
    throw new ApiError(
      400, "INVALID_ADDRESS_ID", "Invalid address ID."
    );
  }
}

function validateAddress(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(
      400, "INVALID_ADDRESS", "Address details are required."
    );
  }

  const data = {};

  for (const field of fields) {
    if (
      typeof body[field] !== "string" ||
      !body[field].trim() ||
      body[field].trim().length > 255
    ) {
      throw new ApiError(
        400,
        "INVALID_ADDRESS",
        `${field} is required and must be 1–255 characters.`
      );
    }

    data[field] = body[field].trim();
  }

  if (
    body.is_default !== undefined &&
    typeof body.is_default !== "boolean"
  ) {
    throw new ApiError(
      400,
      "INVALID_ADDRESS",
      "is_default must be true or false."
    );
  }

  data.is_default = body.is_default === true;

  return data;
}

async function listAddresses(req, res, next) {
  try {
    const data = await addresses.findAll(req.user.id);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

async function getAddress(req, res, next) {
  try {
    validateId(req.params.id);

    const address = await addresses.findById(
      req.params.id, req.user.id
    );

    if (!address) {
      throw new ApiError(
        404, "ADDRESS_NOT_FOUND", "Address not found."
      );
    }

    res.json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
}

async function createAddress(req, res, next) {
  try {
    const data = validateAddress(req.body);
    const address = await addresses.create(req.user.id, data);

    res.status(201).json({
      success: true,
      data: address
    });
  } catch (error) {
    next(error);
  }
}

async function updateAddress(req, res, next) {
  try {
    validateId(req.params.id);

    const data = validateAddress(req.body);

    const address = await addresses.update(
      req.params.id, req.user.id, data
    );

    if (!address) {
      throw new ApiError(
        404, "ADDRESS_NOT_FOUND", "Address not found."
      );
    }

    res.json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
}

async function deleteAddress(req, res, next) {
  try {
    validateId(req.params.id);

    const address = await addresses.remove(
      req.params.id, req.user.id
    );

    if (!address) {
      throw new ApiError(
        404, "ADDRESS_NOT_FOUND", "Address not found."
      );
    }

    res.json({
      success: true,
      message: "Address deleted successfully."
    });
  } catch (error) {
    if (error.code === "23503") {
      return next(new ApiError(
        409,
        "ADDRESS_IN_USE",
        "This address is linked to an order and cannot be deleted."
      ));
    }

    next(error);
  }
}

async function setDefaultAddress(req, res, next) {
  try {
    validateId(req.params.id);

    const address = await addresses.setDefault(
      req.params.id, req.user.id
    );

    if (!address) {
      throw new ApiError(
        404, "ADDRESS_NOT_FOUND", "Address not found."
      );
    }

    res.json({ success: true, data: address });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listAddresses,
  getAddress,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
