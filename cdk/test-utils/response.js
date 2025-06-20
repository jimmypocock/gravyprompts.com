// Response parsing utilities for tests

/**
 * Parse a Lambda response and return both status and parsed body
 * @param {Object} response - Lambda response object
 * @returns {Object} { statusCode, body, headers }
 */
const parseResponse = (response) => {
  return {
    statusCode: response.statusCode,
    headers: response.headers,
    body: JSON.parse(response.body),
  };
};

/**
 * Assert a successful response with optional body checks
 * @param {Object} response - Lambda response object
 * @param {number} expectedStatus - Expected status code (default 200)
 * @returns {Object} Parsed response body
 */
const expectSuccessResponse = (response, expectedStatus = 200) => {
  const { statusCode, body } = parseResponse(response);
  expect(statusCode).toBe(expectedStatus);
  return body;
};

/**
 * Assert an error response with expected status and error message
 * @param {Object} response - Lambda response object
 * @param {number} expectedStatus - Expected status code
 * @param {string} expectedError - Expected error message
 * @returns {Object} Parsed response body
 */
const expectErrorResponse = (response, expectedStatus, expectedError) => {
  const { statusCode, body } = parseResponse(response);
  expect(statusCode).toBe(expectedStatus);
  expect(body.error).toBe(expectedError);
  return body;
};

module.exports = {
  parseResponse,
  expectSuccessResponse,
  expectErrorResponse,
};