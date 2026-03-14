const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Unified HTTP request client with cookie support.
 * Handles 401 responses by dispatching AUTH_INIT_FAILURE via global event.
 */
class ApiClient {
  /**
   * Make a GET request.
   * @param {string} path - API path (e.g., '/api/auth/me')
   * @returns {Promise<object>} Response data
   */
  async get(path) {
    return this._request('GET', path);
  }

  /**
   * Make a POST request.
   * @param {string} path - API path
   * @param {object} [body] - Request body
   * @returns {Promise<object>} Response data
   */
  async post(path, body) {
    return this._request('POST', path, body);
  }

  /**
   * Make a DELETE request.
   * @param {string} path - API path
   * @returns {Promise<object>} Response data
   */
  async del(path) {
    return this._request('DELETE', path);
  }

  /**
   * Internal request handler.
   * @param {string} method - HTTP method
   * @param {string} path - API path
   * @param {object} [body] - Request body (for POST/PUT)
   * @returns {Promise<object>} Parsed response data
   */
  async _request(method, path, body) {
    const url = `${BASE_URL}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Include cookies for session-based auth (Web)
    };

    if (body !== undefined) {
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(url, options);
    } catch (networkError) {
      const error = new Error('网络连接失败，请稍后重试');
      error.isNetworkError = true;
      throw error;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.error || data.message || '请求失败');
      error.status = response.status;
      error.data = data;
      error.error = data.error;
      throw error;
    }

    return data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
