/**
 * 测试文件：自定义错误类
 *
 * 测试目标：
 * - AppError（基础错误类）
 * - UnauthorizedError（401 未授权）
 * - ConflictError（409 冲突）
 */

import { AppError, UnauthorizedError, ConflictError } from '../src/lib/errors.js';

describe('错误类 - AppError', () => {
  it('应创建基础错误实例，包含 statusCode 和 message', () => {
    const error = new AppError('测试错误', 400);

    expect(error.message).toBe('测试错误');
    expect(error.statusCode).toBe(400);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
  });

  it('应在没有传入 statusCode 时默认为 500', () => {
    const error = new AppError('内部错误');

    expect(error.statusCode).toBe(500);
    expect(error.message).toBe('内部错误');
  });

  it('应正确设置 error name', () => {
    const error = new AppError('测试', 400);

    expect(error.name).toBe('AppError');
  });

  it('应包含错误堆栈信息', () => {
    const error = new AppError('测试', 400);

    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
    expect(error.stack).toContain('AppError');
  });
});

describe('错误类 - UnauthorizedError', () => {
  it('应创建 401 错误实例', () => {
    const error = new UnauthorizedError('请先登录');

    expect(error.message).toBe('请先登录');
    expect(error.statusCode).toBe(401);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof UnauthorizedError).toBe(true);
  });

  it('应使用默认消息"未授权"', () => {
    const error = new UnauthorizedError();

    expect(error.message).toBe('未授权');
    expect(error.statusCode).toBe(401);
  });

  it('应正确设置 error name', () => {
    const error = new UnauthorizedError();

    expect(error.name).toBe('UnauthorizedError');
  });

  it('应包含错误堆栈信息', () => {
    const error = new UnauthorizedError('请先登录');

    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
  });
});

describe('错误类 - ConflictError', () => {
  it('应创建 409 错误实例', () => {
    const error = new ConflictError('该邮箱已被注册');

    expect(error.message).toBe('该邮箱已被注册');
    expect(error.statusCode).toBe(409);
    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
    expect(error instanceof ConflictError).toBe(true);
  });

  it('应使用默认消息"资源冲突"', () => {
    const error = new ConflictError();

    expect(error.message).toBe('资源冲突');
    expect(error.statusCode).toBe(409);
  });

  it('应正确设置 error name', () => {
    const error = new ConflictError();

    expect(error.name).toBe('ConflictError');
  });

  it('应包含错误堆栈信息', () => {
    const error = new ConflictError('资源已存在');

    expect(error.stack).toBeDefined();
    expect(typeof error.stack).toBe('string');
  });
});

describe('错误类 - 继承关系验证', () => {
  it('UnauthorizedError 应继承自 AppError', () => {
    const error = new UnauthorizedError('测试');

    expect(error instanceof AppError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });

  it('ConflictError 应继承自 AppError', () => {
    const error = new ConflictError('测试');

    expect(error instanceof AppError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });

  it('不同错误类实例应可区分', () => {
    const appError = new AppError('通用错误', 500);
    const unauthorizedError = new UnauthorizedError('未授权');
    const conflictError = new ConflictError('冲突');

    expect(appError instanceof UnauthorizedError).toBe(false);
    expect(appError instanceof ConflictError).toBe(false);
    expect(unauthorizedError instanceof ConflictError).toBe(false);
    expect(conflictError instanceof UnauthorizedError).toBe(false);
  });
});

describe('错误类 - 错误传播场景', () => {
  it('应能在 try-catch 中正确捕获', () => {
    expect(() => {
      throw new AppError('测试错误', 400);
    }).toThrow(AppError);

    expect(() => {
      throw new UnauthorizedError('未授权');
    }).toThrow(UnauthorizedError);

    expect(() => {
      throw new ConflictError('冲突');
    }).toThrow(ConflictError);
  });

  it('应能通过 instanceof 检查错误类型', () => {
    try {
      throw new UnauthorizedError('Session 过期');
    } catch (error) {
      expect(error instanceof UnauthorizedError).toBe(true);
      expect(error instanceof AppError).toBe(true);
      expect(error.statusCode).toBe(401);
    }
  });

  it('应能通过 statusCode 区分 HTTP 错误类型', () => {
    const errors = [
      new AppError('通用错误', 500),
      new UnauthorizedError(),
      new ConflictError(),
    ];

    expect(errors[0].statusCode).toBe(500);
    expect(errors[1].statusCode).toBe(401);
    expect(errors[2].statusCode).toBe(409);
  });
});
