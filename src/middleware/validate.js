
const ApiError = require("../utils/ApiError");

function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(
        new ApiError(
          422,
          "VALIDATION_ERROR",
          "Please check the submitted information.",
          result.error.flatten()
        )
      );
    }

    req[source] = result.data;
    next();
  };
}

module.exports = validate;
