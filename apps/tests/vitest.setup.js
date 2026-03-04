/**
 * Vitest setup file
 * 在所有测试运行前执行的全局配置
 */

import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// 每个测试后自动清理 DOM
afterEach(() => {
  cleanup();
});

// 扩展 expect 断言（可选）
// import * as matchers from '@testing-library/jest-dom/matchers';
// expect.extend(matchers);
