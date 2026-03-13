/**
 * Unified HTTP request client
 *
 * - Always sends credentials (cookies) for web platform cookie-based auth
 * - Automatically dispatches AUTH_INIT_FAILURE on HTTP 401 responses
 * - Exposes get(), post(), del() convenience methods
 */

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

// Internal dispatch function — overridden by AuthContext after initialization
let _dispatch = null;

/**
 * Register the AuthContext dispatcher so the client can trigger auth actions.
 * Called by AuthProvider on mount.
 */
export function registerDispatch(dispatch) {
  _dispatch = dispatch;
}

/**
 * Core fetch wrapper with default options.
 * @param {string} path - API path (e.g. '/api/auth/me')
 * @param {RequestInit} options - fetch options
 * @returns {Promise<Response>}
 */
async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  // Handle 401 globally — trigger auth failure action
  if (response.status === 401 && _dispatch) {
    _dispatch({ type: 'AUTH_INIT_FAILURE' });
  }

  return response;
}

/**
 * HTTP GET
 */
export function get(path) {
  return request(path, { method: 'GET' });
}

/**
 * HTTP POST with JSON body
 */
export function post(path, body) {
  return request(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

/**
 * HTTP DELETE
 */
export function del(path) {
  return request(path, { method: 'DELETE' });
}

export default { get, post, del, registerDispatch };
