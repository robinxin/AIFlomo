/**
 * Unified application error classes.
 *
 * All route handlers and service layer code should throw these errors.
 * The global setErrorHandler in src/index.js catches them and sends a
 * standardised JSON response: { data: null, error: string, message: string }.
 */

/**
 * Base application error.
 *
 * @extends Error
 */
export class AppError extends Error {
  /**
   * @param {string} message   - Human-readable description of the error.
   * @param {number} statusCode - HTTP status code to send in the response (default 500).
   */
  constructor(message, statusCode = 500) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;

    // Maintain proper prototype chain in transpiled environments.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when a requested resource does not exist.
 * Produces an HTTP 404 response.
 *
 * @extends AppError
 *
 * @example
 *   throw new NotFoundError('Memo');  // message: "Memo not found"
 *   throw new NotFoundError('Tag');   // message: "Tag not found"
 */
export class NotFoundError extends AppError {
  /**
   * @param {string} resourceName - The name of the resource that was not found (e.g. "Memo", "Tag").
   */
  constructor(resourceName) {
    super(`${resourceName} not found`, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when the authenticated user does not have permission to access or modify a resource.
 * Produces an HTTP 403 response.
 *
 * @extends AppError
 *
 * @example
 *   throw new ForbiddenError();
 *   throw new ForbiddenError('Access denied to this resource');
 */
export class ForbiddenError extends AppError {
  /**
   * @param {string} [message='Forbidden'] - Optional custom error message.
   */
  constructor(message = 'Forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Thrown when a request is made without valid authentication credentials.
 * Produces an HTTP 401 response.
 *
 * @extends AppError
 *
 * @example
 *   throw new UnauthorizedError();
 *   throw new UnauthorizedError('Session expired');
 */
export class UnauthorizedError extends AppError {
  /**
   * @param {string} [message='Unauthorized'] - Optional custom error message.
   */
  constructor(message = 'Unauthorized') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}
