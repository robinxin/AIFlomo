/**
 * AuthFormError 组件单元测试（Vitest）
 *
 * 覆盖范围：
 *   - message 为 null 时不渲染
 *   - message 为空字符串时不渲染
 *   - message 非空时渲染错误提示文字
 *   - 渲染的错误提示内容与 message 一致
 *   - testID prop 正确传递
 *
 * 测试在 RED 阶段编写，实现代码尚未存在，预期全部失败。
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock: react-native
// ---------------------------------------------------------------------------

vi.mock('react-native', async () => {
  const RN = await vi.importActual('react-native');
  return {
    ...RN,
    View: ({ children, style, testID, ...props }) => (
      React.createElement('div', { 'data-testid': testID, style, ...props }, children)
    ),
    Text: ({ children, style, testID, ...props }) => (
      React.createElement('span', { 'data-testid': testID, style, ...props }, children)
    ),
    StyleSheet: { create: (s) => s },
  };
});

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

import { AuthFormError } from '../../components/AuthFormError.jsx';

// ---------------------------------------------------------------------------
// message 为空 — 不渲染
// ---------------------------------------------------------------------------

describe('AuthFormError — message 为空时不渲染', () => {
  it('message 为 null — 组件返回 null，不渲染任何 DOM', () => {
    const { container } = render(<AuthFormError message={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('message 为空字符串 — 组件返回 null，不渲染任何 DOM', () => {
    const { container } = render(<AuthFormError message="" />);
    expect(container.firstChild).toBeNull();
  });

  it('message 为 undefined — 组件返回 null，不渲染任何 DOM', () => {
    const { container } = render(<AuthFormError message={undefined} />);
    expect(container.firstChild).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// message 非空 — 渲染错误提示
// ---------------------------------------------------------------------------

describe('AuthFormError — message 非空时渲染错误提示', () => {
  it('message 为"该邮箱已被注册"— 渲染该文字', () => {
    render(<AuthFormError message="该邮箱已被注册" />);
    expect(screen.getByText('该邮箱已被注册')).toBeTruthy();
  });

  it('message 为"邮箱或密码错误，请重试"— 渲染该文字', () => {
    render(<AuthFormError message="邮箱或密码错误，请重试" />);
    expect(screen.getByText('邮箱或密码错误，请重试')).toBeTruthy();
  });

  it('message 为"网络连接失败，请稍后重试"— 渲染该文字', () => {
    render(<AuthFormError message="网络连接失败，请稍后重试" />);
    expect(screen.getByText('网络连接失败，请稍后重试')).toBeTruthy();
  });

  it('渲染的文字内容与 message prop 完全一致', () => {
    const errorMsg = '服务器内部错误，请稍后重试';
    render(<AuthFormError message={errorMsg} />);
    expect(screen.getByText(errorMsg)).toBeTruthy();
  });

  it('message 由非空变为 null 后，错误提示从 DOM 中消失', () => {
    const { rerender } = render(<AuthFormError message="某个错误" />);
    expect(screen.getByText('某个错误')).toBeTruthy();

    rerender(<AuthFormError message={null} />);
    expect(screen.queryByText('某个错误')).toBeNull();
  });

  it('message 由 null 变为非空后，错误提示出现在 DOM 中', () => {
    const { rerender } = render(<AuthFormError message={null} />);
    expect(screen.queryByText('新的错误')).toBeNull();

    rerender(<AuthFormError message="新的错误" />);
    expect(screen.getByText('新的错误')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// testID prop
// ---------------------------------------------------------------------------

describe('AuthFormError — testID prop', () => {
  it('传入 testID 时，根容器有对应的 testID 属性', () => {
    render(<AuthFormError message="某个错误" testID="auth-form-error" />);
    expect(screen.getByTestId('auth-form-error')).toBeTruthy();
  });

  it('testID 内包含错误文字', () => {
    render(<AuthFormError message="某个错误提示" testID="auth-error-box" />);
    const errorContainer = screen.getByTestId('auth-error-box');
    expect(errorContainer.textContent).toContain('某个错误提示');
  });
});

// ---------------------------------------------------------------------------
// 特殊字符 / 边界值
// ---------------------------------------------------------------------------

describe('AuthFormError — 特殊内容', () => {
  it('message 包含特殊字符 — 正确渲染', () => {
    render(<AuthFormError message="Error: <script>alert(1)</script>" />);
    // 应作为纯文本渲染，不执行脚本
    expect(screen.getByText('Error: <script>alert(1)</script>')).toBeTruthy();
  });

  it('message 包含中文、英文、数字、标点 — 正确渲染', () => {
    const msg = '用户名 test123: 已被占用！';
    render(<AuthFormError message={msg} />);
    expect(screen.getByText(msg)).toBeTruthy();
  });
});
