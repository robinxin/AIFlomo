export class AppError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = '请先登录') {
    super(401, message, 'UNAUTHORIZED');
  }
}

export class ConflictError extends AppError {
  constructor(message = '资源冲突') {
    super(409, message, 'CONFLICT');
  }
}
