import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AuthFormError } from '../../components/AuthFormError.jsx';

describe('AuthFormError', () => {
  test('renders nothing when message is null', () => {
    const { container } = render(React.createElement(AuthFormError, { message: null }));
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when message is empty string', () => {
    const { container } = render(React.createElement(AuthFormError, { message: '' }));
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when message is undefined', () => {
    const { container } = render(React.createElement(AuthFormError, { message: undefined }));
    expect(container.firstChild).toBeNull();
  });

  test('renders error message when message is provided', () => {
    render(React.createElement(AuthFormError, { message: '该邮箱已被注册' }));
    expect(screen.getByText('该邮箱已被注册')).toBeTruthy();
  });

  test('renders error message with testID', () => {
    render(React.createElement(AuthFormError, { message: '错误', testID: 'auth-error' }));
    expect(screen.getByTestId('auth-error')).toBeTruthy();
  });

  test('renders various error messages correctly', () => {
    render(React.createElement(AuthFormError, { message: '邮箱或密码错误，请重试' }));
    expect(screen.getByText('邮箱或密码错误，请重试')).toBeTruthy();
  });

  test('renders long error messages correctly', () => {
    const longMessage = '网络连接失败，请检查您的网络设置后重试，如果问题持续，请联系客服支持团队获取帮助';
    render(React.createElement(AuthFormError, { message: longMessage }));
    expect(screen.getByText(longMessage)).toBeTruthy();
  });
});
