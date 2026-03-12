/**
 * apps/server/src/lib/errors.js
 *
 * 统一错误类定义。路由层通过 throw 抛出，由全局 setErrorHandler 统一捕获并格式化响应。
 *
 * 错误层级：
 *   Error
 *   └── AppError          (通用业务错误，含 statusCode 和 code)
 *       ├── NotFoundError (404，资源不存在)
 *       └── ForbiddenError (403，无权限访问)
 *
 * 响应格式（由 setErrorHandler 生成）：
 *   { data: null, error: string, message: string }
 */

/**
 * AppError — 通用业务异常基类
 *
 * @param {string} message    - 人类可读的错误描述（也是 Error.message）
 * @param {number} statusCode - HTTP 状态码，默认 500
 * @param {string} code       - 机器可读的错误代码，默认 'INTERNAL_ERROR'
 */
export class AppError extends Error {
  constructor(message = 'Internal server error', statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;

    // 确保 instanceof 检查在 ES6 class 继承中正常工作
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * NotFoundError — 资源不存在（HTTP 404）
 *
 * 使用场景：
 *   - 笔记不存在：throw new NotFoundError('Memo')
 *   - 标签不存在：throw new NotFoundError('Tag')
 *
 * @param {string} [resourceName] - 资源类型名称（如 'Memo'、'Tag'），用于生成 message
 */
export class NotFoundError extends AppError {
  constructor(resourceName) {
    const message = resourceName
      ? `${resourceName} not found`
      : 'Resource not found';
    super(message, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * ForbiddenError — 无权限访问当前资源（HTTP 403）
 *
 * 使用场景：
 *   - 笔记属于其他用户：throw new ForbiddenError()
 *   - 标签属于其他用户：throw new ForbiddenError()
 *
 * @param {string} [message] - 可选的自定义错误描述，默认 'Forbidden'
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}
