/**
 * login.jsx 单元测试（Vitest）
 *
 * 覆盖范围：
 *   - 初始渲染（输入框、按钮、链接）
 *   - 无失焦验证（登录页不做实时验证）
 *   - 成功登录：调用 useAuth().login，成功后 router.replace('/')
 *   - 失败登录（401）：显示"邮箱或密码错误，请重试"，密码清空，邮箱保留
 *   - 网络错误：显示"网络连接失败，请稍后重试"
 *   - 点击"立即注册"：清空表单并 router.push('/register')
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock: react-native
// ---------------------------------------------------------------------------

vi.mock('react-native', async () => {
  const actual = await vi.importActual('react-native');
  return {
    ...actual,
    StyleSheet: { create: (s) => s },
  };
});

// ---------------------------------------------------------------------------
// Mock: expo-router
// ---------------------------------------------------------------------------

const mockRouterReplace = vi.fn();
const mockRouterPush = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    push: mockRouterPush,
  }),
}));

// ---------------------------------------------------------------------------
// Mock: AuthContext
// ---------------------------------------------------------------------------

const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockLogout = vi.fn();

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    loading: false,
    isAuthenticated: false,
    user: null,
    login: mockLogin,
    register: mockRegister,
    logout: mockLogout,
  }),
}));

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

import LoginScreen from '../../app/login.jsx';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LoginScreen — 初始渲染', () => {
  it('渲染邮箱输入框', () => {
    render(<LoginScreen />);
    expect(screen.getByTestId('login-email')).toBeTruthy();
  });

  it('渲染密码输入框', () => {
    render(<LoginScreen />);
    expect(screen.getByTestId('login-password')).toBeTruthy();
  });

  it('渲染"登录"提交按钮', () => {
    render(<LoginScreen />);
    expect(screen.getByTestId('login-submit')).toBeTruthy();
  });

  it('渲染"立即注册"链接', () => {
    render(<LoginScreen />);
    expect(screen.getByTestId('login-go-register')).toBeTruthy();
  });
});

describe('LoginScreen — 登录成功', () => {
  it('登录成功后调用 router.replace("/")', async () => {
    mockLogin.mockResolvedValueOnce({
      id: 'uuid-1',
      email: 'user@example.com',
      nickname: '小明',
    });

    render(<LoginScreen />);
    const emailInput = screen.getByTestId('login-email');
    const passwordInput = screen.getByTestId('login-password');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByTestId('login-submit');
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'password123');
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });
});

describe('LoginScreen — 登录失败', () => {
  it('密码错误时（401）显示"邮箱或密码错误，请重试"', async () => {
    mockLogin.mockRejectedValueOnce(new Error('邮箱或密码错误，请重试'));

    render(<LoginScreen />);
    const emailInput = screen.getByTestId('login-email');
    const passwordInput = screen.getByTestId('login-password');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

    const submitButton = screen.getByTestId('login-submit');
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('邮箱或密码错误，请重试')).toBeTruthy();
    });
  });

  it('密码错误时密码输入框自动清空', async () => {
    mockLogin.mockRejectedValueOnce(new Error('邮箱或密码错误，请重试'));

    render(<LoginScreen />);
    const emailInput = screen.getByTestId('login-email');
    const passwordInput = screen.getByTestId('login-password');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

    const submitButton = screen.getByTestId('login-submit');
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('login-password').value).toBe('');
    });
  });

  it('密码错误时邮箱输入框保留原内容', async () => {
    mockLogin.mockRejectedValueOnce(new Error('邮箱或密码错误，请重试'));

    render(<LoginScreen />);
    const emailInput = screen.getByTestId('login-email');
    const passwordInput = screen.getByTestId('login-password');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } });

    const submitButton = screen.getByTestId('login-submit');
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByTestId('login-email').value).toBe('user@example.com');
    });
  });

  it('网络错误时显示"网络连接失败，请稍后重试"', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Network error'));

    render(<LoginScreen />);
    const emailInput = screen.getByTestId('login-email');
    const passwordInput = screen.getByTestId('login-password');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByTestId('login-submit');
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('网络连接失败，请稍后重试')).toBeTruthy();
    });
  });
});

describe('LoginScreen — 跳转注册', () => {
  it('点击"立即注册"后调用 router.push("/register")', async () => {
    render(<LoginScreen />);
    const goRegisterButton = screen.getByTestId('login-go-register');
    fireEvent.click(goRegisterButton);
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/register');
    });
  });

  it('点击"立即注册"后清空邮箱输入框', async () => {
    render(<LoginScreen />);
    const emailInput = screen.getByTestId('login-email');
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

    const goRegisterButton = screen.getByTestId('login-go-register');
    fireEvent.click(goRegisterButton);

    await waitFor(() => {
      expect(screen.getByTestId('login-email').value).toBe('');
    });
  });

  it('点击"立即注册"后清空密码输入框', async () => {
    render(<LoginScreen />);
    const passwordInput = screen.getByTestId('login-password');
    fireEvent.change(passwordInput, { target: { value: 'somepassword' } });

    const goRegisterButton = screen.getByTestId('login-go-register');
    fireEvent.click(goRegisterButton);

    await waitFor(() => {
      expect(screen.getByTestId('login-password').value).toBe('');
    });
  });
});

describe('LoginScreen — 加载状态', () => {
  it('提交时按钮显示"登录中..."（加载状态）', async () => {
    // login 不立即 resolve — 保持 pending 状态
    let resolveLogin;
    mockLogin.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveLogin = resolve;
      })
    );

    render(<LoginScreen />);
    const emailInput = screen.getByTestId('login-email');
    const passwordInput = screen.getByTestId('login-password');

    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });

    const submitButton = screen.getByTestId('login-submit');
    act(() => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('登录中...')).toBeTruthy();
    });

    // Resolve to clean up
    resolveLogin({ id: 'uuid-1', email: 'user@example.com', nickname: '小明' });
  });
});
