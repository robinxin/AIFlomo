/**
 * apps/mobile/lib/api-client.js
 * Task T008 - 统一 HTTP 请求封装
 *
 * 封装 fetch，默认携带 credentials: 'include'（Web Cookie 透传）。
 * 统一处理 HTTP 401 响应（dispatch AUTH_INIT_FAILURE）。
 * 暴露 get(path)、post(path, body)、del(path) 方法。
 *
 * 使用方式:
 *   const client = createApiClient({ baseURL, dispatch });
 *   await client.get('/api/auth/me');
 *   await client.post('/api/auth/login', { email, password });
 *   await client.del('/api/memos/1');
 */

/**
 * 创建 API 客户端实例。
 *
 * @param {object} options
 * @param {string} options.baseURL - API 根地址（如 'http://localhost:3000'）
 * @param {function} options.dispatch - AuthContext 的 dispatch 函数，用于触发全局认证状态变更
 * @returns {{ get: function, post: function, del: function }}
 */
export function createApiClient({ baseURL, dispatch } = {}) {
  if (typeof baseURL !== 'string' || baseURL.length === 0) {
    throw new TypeError('createApiClient: baseURL 必须是非空字符串');
  }
  if (typeof dispatch !== 'function') {
    throw new TypeError('createApiClient: dispatch 必须是函数');
  }
  /**
   * 发起 HTTP 请求并统一处理响应。
   *
   * @param {string} path - API 路径（如 '/api/auth/me'）
   * @param {RequestInit} options - fetch 配置项
   * @returns {Promise<any>} 解析后的 JSON 响应体
   * @throws {Error} 网络错误、非 2xx 响应（含 401 后触发 dispatch）、JSON 解析失败
   */
  async function request(path, options) {
    const url = `${baseURL}${path}`;
    const fetchOptions = {
      ...options,
      credentials: 'include',
    };

    let response;
    try {
      response = await fetch(url, fetchOptions);
    } catch {
      throw new Error('网络连接失败，请稍后重试');
    }

    if (response.status === 401) {
      dispatch({ type: 'AUTH_INIT_FAILURE' });
      throw new Error('未授权，请重新登录');
    }

    let body;
    try {
      body = await response.json();
    } catch {
      if (!response.ok) {
        throw new Error(`请求失败（HTTP ${response.status}）`);
      }
      throw new Error('服务器响应格式错误');
    }

    if (!response.ok) {
      const errorMessage = body?.error || `请求失败（HTTP ${response.status}）`;
      throw new Error(errorMessage);
    }

    return body;
  }

  return {
    /**
     * 发起 GET 请求。
     *
     * @param {string} path - API 路径
     * @returns {Promise<any>} 解析后的 JSON 响应体
     */
    get(path) {
      return request(path, { method: 'GET' });
    },

    /**
     * 发起 POST 请求。
     *
     * @param {string} path - API 路径
     * @param {object} body - 请求体（将被序列化为 JSON）
     * @returns {Promise<any>} 解析后的 JSON 响应体
     */
    post(path, body) {
      return request(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },

    /**
     * 发起 DELETE 请求。
     *
     * @param {string} path - API 路径
     * @returns {Promise<any>} 解析后的 JSON 响应体
     */
    del(path) {
      return request(path, { method: 'DELETE' });
    },
  };
}
