/**
 * Custom error classes for structured HTTP error handling.
 *
 * Hierarchy:
 *   Error
 *   └── AppError          (base class, configurable statusCode, default 500)
 *       ├── UnauthorizedError  (fixed statusCode 401)
 *       └── ConflictError      (fixed statusCode 409)
 *
 * Usage:
 *   import { AppError, UnauthorizedError, ConflictError } from './lib/errors.js';
 *
 *   throw new UnauthorizedError('请先登录');
 *
 *   // In an error handler:
 *   if (err instanceof AppError) {
 *     reply.status(err.statusCode).send({ data: null, error: err.name, message: err.message });
 *   }
 */

/**
 * Base application error class.
 *
 * @property {string}  message    - Human-readable error description.
 * @property {number}  statusCode - HTTP status code associated with this error.
 * @property {string|null} code   - Optional machine-readable error code.
 * @property {string}  name       - Constructor name of the error (auto-derived).
 * @property {string}  stack      - Full stack trace string.
 */
class AppError extends Error {
  /**
   * @param {string}      message         - Error message.
   * @param {number}      [statusCode=500] - HTTP status code.
   * @param {string|null} [code=null]     - Optional machine-readable error code.
   */
  constructor(message, statusCode = 500, code = null) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;

    // Capture a V8-style stack trace that excludes this constructor frame,
    // making the trace point to the call site rather than to this file.
    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * 401 Unauthorized error.
 *
 * Thrown when a request requires authentication but no valid session exists,
 * or when the session has expired.
 */
class UnauthorizedError extends AppError {
  /**
   * @param {string}      [message='未授权'] - Custom error message.
   * @param {string|null} [code=null]       - Optional machine-readable error code.
   */
  constructor(message = '未授权', code = null) {
    super(message, 401, code);
  }
}

/**
 * 409 Conflict error.
 *
 * Thrown when a resource already exists and cannot be created again
 * (e.g. duplicate email address during registration).
 */
class ConflictError extends AppError {
  /**
   * @param {string}      [message='资源冲突'] - Custom error message.
   * @param {string|null} [code=null]         - Optional machine-readable error code.
   */
  constructor(message = '资源冲突', code = null) {
    super(message, 409, code);
  }
}

export { AppError, UnauthorizedError, ConflictError };
