/**
 * AuthFormError.test.js
 *
 * Unit tests for apps/mobile/components/AuthFormError.jsx
 *
 * Uses React.createElement() instead of JSX to avoid requiring a
 * special Vite/esbuild config for .test.js files.
 *
 * Coverage targets:
 *  - Returns null (renders nothing) when message is null
 *  - Returns null (renders nothing) when message is an empty string
 *  - Renders the error message text when message is a non-empty string
 *  - testID is forwarded to the container element
 *  - Multiple successive error messages are rendered correctly
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

const h = React.createElement;

// ---------------------------------------------------------------------------
// Mock react-native
// ---------------------------------------------------------------------------
vi.mock('react-native', () => {
  function View({ children, style, testID, ...rest }) {
    return h('div', { 'data-testid': testID, style, ...rest }, children);
  }

  function Text({ children, style, testID, ...rest }) {
    return h('span', { 'data-testid': testID, style, ...rest }, children);
  }

  return { View, Text };
});

// ---------------------------------------------------------------------------
// Load module under test
// ---------------------------------------------------------------------------
async function loadModule() {
  vi.resetModules();
  const mod = await import('../../components/AuthFormError.jsx');
  return mod;
}

describe('AuthFormError', () => {
  let AuthFormError;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await loadModule();
    AuthFormError = mod.AuthFormError;
  });

  // -------------------------------------------------------------------------
  // null / empty message — nothing rendered
  // -------------------------------------------------------------------------

  it('renders nothing when message is null', () => {
    const { container } = render(h(AuthFormError, { message: null }));
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when message is an empty string', () => {
    const { container } = render(h(AuthFormError, { message: '' }));
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when message is undefined', () => {
    const { container } = render(h(AuthFormError, { message: undefined }));
    expect(container.firstChild).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Non-empty message — card rendered
  // -------------------------------------------------------------------------

  it('renders the error message text when message is a non-empty string', () => {
    render(h(AuthFormError, { message: '该邮箱已被注册' }));
    expect(screen.getByText('该邮箱已被注册')).toBeDefined();
  });

  it('renders a container element (not null) for a non-empty message', () => {
    const { container } = render(h(AuthFormError, { message: '网络连接失败，请稍后重试' }));
    expect(container.firstChild).not.toBeNull();
  });

  it('renders any non-empty message text correctly', () => {
    render(h(AuthFormError, { message: '邮箱或密码错误，请重试' }));
    expect(screen.getByText('邮箱或密码错误，请重试')).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // testID forwarding
  // -------------------------------------------------------------------------

  it('attaches testID to the container element', () => {
    render(h(AuthFormError, {
      message: '发生错误',
      testID: 'auth-error-banner',
    }));

    expect(screen.getByTestId('auth-error-banner')).toBeDefined();
  });

  it('does not render the testID element when message is null', () => {
    render(h(AuthFormError, {
      message: null,
      testID: 'auth-error-banner',
    }));

    expect(screen.queryByTestId('auth-error-banner')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Message content integrity
  // -------------------------------------------------------------------------

  it('renders long error messages without truncation', () => {
    const longMessage = '这是一条非常长的错误信息，用来验证组件能够完整展示服务端返回的较长文本，而不会有任何截断或省略的问题。';
    render(h(AuthFormError, { message: longMessage }));
    expect(screen.getByText(longMessage)).toBeDefined();
  });

  it('renders numeric-like string messages', () => {
    render(h(AuthFormError, { message: '错误代码: 500' }));
    expect(screen.getByText('错误代码: 500')).toBeDefined();
  });
});
