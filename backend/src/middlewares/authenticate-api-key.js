// middleware/authenticate-api-key.js
const { ApiError } = require("../utils");
const { env } = require("../config");

const authenticateApiKey = (req, res, next) => {
  // 1. Check Authorization header (Bearer token)
  const authHeader = req.headers["authorization"];
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  // 2. Check API_KEY header (plain key)
  const apiKeyHeader = req.headers["api_key"]; // headers are lowercase in Node

  // 3. Validate either one
  if (
    (bearerToken && bearerToken === env.NODEJS_API_KEY) ||
    (apiKeyHeader && apiKeyHeader === env.API_KEY)
  ) {
    return next();
  }

  throw new ApiError(401, "Unauthorized. Invalid API key.");
};

module.exports = { authenticateApiKey };
