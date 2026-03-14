/**
 * api-client.js
 *
 * Unified HTTP request client for AIFlomo mobile app.
 *
 * Design goals:
 *  - Wraps the platform `fetch` API with sensible defaults.
 *  - Always sends `credentials: 'include'` so session cookies are
 *    forwarded on Web (cross-origin requests to the Fastify backend).
 *  - Parses every response as JSON and normalises errors into thrown
 *    `Error` instances so callers never have to inspect `response.ok`.
 *  - Intercepts HTTP 401 responses globally and dispatches
 *    `AUTH_INIT_FAILURE` to clear the authenticated state, then
 *    re-throws so callers can react (e.g. redirect to /login).
 *
 * Usage:
 *   import { apiClient } from '../lib/api-client';
 *
 *   // Inject the AuthContext dispatch once during app initialisation:
 *   apiClient.setDispatch(dispatch);
 *
 *   // Make requests:
 *   const data = await apiClient.get('/api/auth/me');
 *   const data = await apiClient.post('/api/auth/login', { email, password });
 *   await apiClient.del('/api/memos/123');
 */

import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Resolve the base API URL from the environment.
 *
 * On native (Android/iOS) the loopback address `127.0.0.1` does not reach
 * the host machine; use `10.0.2.2` for Android emulators and the explicit
 * machine IP for iOS simulators / physical devices.  For Web (browser) we
 * can use a relative path so no CORS issue arises at all.
 *
 * The EXPO_PUBLIC_API_URL env variable takes precedence in all cases.
 */
function resolveBaseUrl() {
  if (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  }

  // Web platform: use empty string so requests become relative paths.
  // This avoids CORS entirely when the frontend is served from the same
  // origin as the backend (e.g. in production or via a reverse proxy).
  if (Platform.OS === 'web') {
    return '';
  }

  // Android emulator loopback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:3000';
  }

  // iOS simulator / physical device — developer must set EXPO_PUBLIC_API_URL
  return 'http://localhost:3000';
}

const BASE_URL = resolveBaseUrl();

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/**
 * Holds the AuthContext `dispatch` function injected by the app root.
 * Must be set via `apiClient.setDispatch()` before any authenticated
 * request is made.
 *
 * @type {Function | null}
 */
let _dispatch = null;

// ---------------------------------------------------------------------------
// Core request helper
// ---------------------------------------------------------------------------

/**
 * Build the full URL from a path.
 *
 * @param {string} path - e.g. '/api/auth/me'
 * @returns {string}
 */
function buildUrl(path) {
  return `${BASE_URL}${path}`;
}

/**
 * Handle a non-OK HTTP response:
 *  1. Attempt to parse the JSON error body for a user-facing message.
 *  2. For 401 responses, dispatch AUTH_INIT_FAILURE to clear auth state.
 *  3. Throw an Error so the calling code can respond appropriately.
 *
 * @param {Response} response - The fetch Response object.
 * @returns {Promise<never>}
 */
async function handleErrorResponse(response) {
  let errorMessage = `HTTP error ${response.status}`;
  let errorBody = null;

  try {
    errorBody = await response.json();
    if (errorBody && typeof errorBody.message === 'string' && errorBody.message) {
      errorMessage = errorBody.message;
    } else if (errorBody && typeof errorBody.error === 'string' && errorBody.error) {
      errorMessage = errorBody.error;
    }
  } catch {
    // Response body was not valid JSON — keep the generic message.
  }

  if (response.status === 401) {
    if (_dispatch) {
      _dispatch({ type: 'AUTH_INIT_FAILURE' });
    }
  }

  const error = new Error(errorMessage);
  error.status = response.status;
  error.body = errorBody;
  throw error;
}

/**
 * Core fetch wrapper.  All public methods (`get`, `post`, `del`) delegate
 * here.
 *
 * @param {string} path - API path, e.g. '/api/auth/login'
 * @param {RequestInit} options - fetch options (method, headers, body, …)
 * @returns {Promise<unknown>} Parsed JSON response body (`data` field when
 *   the server uses the standard { data, message } envelope).
 * @throws {Error} On network failure or non-2xx HTTP status.
 */
async function request(path, options = {}) {
  const url = buildUrl(path);

  const mergedOptions = {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
    },
  };

  let response;
  try {
    response = await fetch(url, mergedOptions);
  } catch (networkError) {
    const error = new Error('网络连接失败，请稍后重试');
    error.cause = networkError;
    throw error;
  }

  if (!response.ok) {
    return handleErrorResponse(response);
  }

  // Parse the JSON body.  The server uses { data, message } envelope.
  // Return the full parsed body so callers can access `data` and `message`.
  try {
    return await response.json();
  } catch {
    // Some endpoints may return an empty body (e.g. 204 No Content).
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * The singleton API client instance.
 *
 * @namespace apiClient
 */
const apiClient = {
  /**
   * Inject the AuthContext dispatch function.  Call this once from the
   * AuthProvider (or the app root) after the reducer has been initialised.
   *
   * @param {Function} dispatch - The `dispatch` function returned by
   *   `useReducer` inside AuthContext.
   */
  setDispatch(dispatch) {
    _dispatch = dispatch;
  },

  /**
   * HTTP GET request.
   *
   * @param {string} path - API path relative to BASE_URL.
   * @returns {Promise<unknown>} Parsed JSON response body.
   * @throws {Error} On network failure or non-2xx status.
   *
   * @example
   * const body = await apiClient.get('/api/auth/me');
   * // body => { data: { id, email, nickname }, message: 'ok' }
   */
  get(path) {
    return request(path, { method: 'GET' });
  },

  /**
   * HTTP POST request with JSON body.
   *
   * @param {string} path - API path relative to BASE_URL.
   * @param {object} body - Request payload; will be JSON-serialised.
   * @returns {Promise<unknown>} Parsed JSON response body.
   * @throws {Error} On network failure or non-2xx status.
   *
   * @example
   * const body = await apiClient.post('/api/auth/login', { email, password });
   * // body => { data: { id, email, nickname }, message: '登录成功' }
   */
  post(path, body) {
    return request(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  /**
   * HTTP DELETE request.
   *
   * @param {string} path - API path relative to BASE_URL.
   * @returns {Promise<unknown>} Parsed JSON response body (may be null for
   *   empty responses).
   * @throws {Error} On network failure or non-2xx status.
   *
   * @example
   * await apiClient.del('/api/memos/123');
   */
  del(path) {
    return request(path, { method: 'DELETE' });
  },

  /**
   * HTTP PUT request with JSON body.
   * Provided for completeness; not required by T008 but commonly needed.
   *
   * @param {string} path - API path relative to BASE_URL.
   * @param {object} body - Request payload; will be JSON-serialised.
   * @returns {Promise<unknown>} Parsed JSON response body.
   * @throws {Error} On network failure or non-2xx status.
   */
  put(path, body) {
    return request(path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
};

export { apiClient };
