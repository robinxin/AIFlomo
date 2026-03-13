/**
 * register.jsx 单元测试（Vitest）
 *
 * 覆盖范围：
 *   - 初始渲染（输入框、按钮、链接）
 *   - 字段级失焦验证（邮箱格式、昵称长度、密码长度）
 *   - 提交时全量校验（阻止提交）
 *   - 隐私协议未勾选时阻止提交
 *   - 成功注册：调用 useAuth().register，成功后 router.replace('/')
 *   - 失败注册：服务端错误显示在表单顶部
 *   - 网络错误：显示"网络连接失败，请稍后重试"
 *   - 点击"返回登录"：清空表单并跳转 /login
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

const mockRegister = vi.fn();
const mockLogin = vi.fn();
const mockLogout = vi.fn();

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    loading: false,
    isAuthenticated: false,
    user: null,
    register: mockRegister,
    login: mockLogin,
    logout: mockLogout,
  }),
}));

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

import RegisterScreen from '../../app/register.jsx';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RegisterScreen — 初始渲染', () => {
  it('渲染邮箱输入框', () => {
    render(<RegisterScreen />);
    expect(screen.getByTestId('register-email')).toBeTruthy();
  });

  it('渲染昵称输入框', () => {
    render(<RegisterScreen />);
    expect(screen.getByTestId('register-nickname')).toBeTruthy();
  });

  it('渲染密码输入框', () => {
    render(<RegisterScreen />);
    expect(screen.getByTestId('register-password')).toBeTruthy();
  });

  it('渲染隐私协议勾选框', () => {
    render(<RegisterScreen />);
    expect(screen.getByTestId('register-privacy-checkbox')).toBeTruthy();
  });

  it('渲染"注册"提交按钮', () => {
    render(<RegisterScreen />);
    expect(screen.getByTestId('register-submit')).toBeTruthy();
  });

  it('渲染"返回登录"链接', () => {
    render(<RegisterScreen />);
    expect(screen.getByTestId('register-go-login')).toBeTruthy();
  });
});

describe('RegisterScreen — 邮箱失焦验证', () => {
  it('无效邮箱格式失焦后显示错误', async () => {
    render(<RegisterScreen />);
    const emailInput = screen.getByTestId('register-email');
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    fireEvent.blur(emailInput);
    await waitFor(() => {
      expect(screen.getByText('请输入有效的邮箱地址')).toBeTruthy();
    });
  });

  it('有效邮箱失焦后不显示错误', async () => {
    render(<RegisterScreen />);
    const emailInput = screen.getByTestId('register-email');
    fireEvent.change(emailInput, { target: { value: 'valid@example.com' } });
    fireEvent.blur(emailInput);
    await waitFor(() => {
      expect(screen.queryByText('请输入有效的邮箱地址')).toBeNull();
    });
  });
});

describe('RegisterScreen — 昵称失焦验证', () => {
  it('昵称少于 2 字符（trim后）失焦后显示错误', async () => {
    render(<RegisterScreen />);
    const nicknameInput = screen.getByTestId('register-nickname');
    fireEvent.change(nicknameInput, { target: { value: 'a' } });
    fireEvent.blur(nicknameInput);
    await waitFor(() => {
      expect(screen.getByText('昵称长度为 2-20 字符')).toBeTruthy();
    });
  });

  it('昵称纯空格（trim后为空）失焦后显示错误', async () => {
    render(<RegisterScreen />);
    const nicknameInput = screen.getByTestId('register-nickname');
    fireEvent.change(nicknameInput, { target: { value: '   ' } });
    fireEvent.blur(nicknameInput);
    await waitFor(() => {
      expect(screen.getByText('昵称长度为 2-20 字符')).toBeTruthy();
    });
  });

  it('昵称 2 字符以上且非纯空格失焦后不显示错误', async () => {
    render(<RegisterScreen />);
    const nicknameInput = screen.getByTestId('register-nickname');
    fireEvent.change(nicknameInput, { target: { value: '小明' } });
    fireEvent.blur(nicknameInput);
    await waitFor(() => {
      expect(screen.queryByText('昵称长度为 2-20 字符')).toBeNull();
    });
  });
});

describe('RegisterScreen — 密码失焦验证', () => {
  it('密码少于 8 字符失焦后显示错误', async () => {
    render(<RegisterScreen />);
    const passwordInput = screen.getByTestId('register-password');
    fireEvent.change(passwordInput, { target: { value: '1234567' } });
    fireEvent.blur(passwordInput);
    await waitFor(() => {
      expect(screen.getByText('密码长度至少为 8 个字符')).toBeTruthy();
    });
  });

  it('密码 8 字符以上失焦后不显示错误', async () => {
    render(<RegisterScreen />);
    const passwordInput = screen.getByTestId('register-password');
    fireEvent.change(passwordInput, { target: { value: '12345678' } });
    fireEvent.blur(passwordInput);
    await waitFor(() => {
      expect(screen.queryByText('密码长度至少为 8 个字符')).toBeNull();
    });
  });
});

describe('RegisterScreen — 提交校验', () => {
  it('未填写任何字段时点击"注册"不调用 register', async () => {
    render(<RegisterScreen />);
    const submitButton = screen.getByTestId('register-submit');
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  it('未勾选隐私协议时点击"注册"不调用 register', async () => {
    render(<RegisterScreen />);
    const emailInput = screen.getByTestId('register-email');
    const nicknameInput = screen.getByTestId('register-nickname');
    const passwordInput = screen.getByTestId('register-password');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(nicknameInput, { target: { value: '小明' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    const submitButton = screen.getByTestId('register-submit');
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(mockRegister).not.toHaveBeenCalled();
    });
  });
});

describe('RegisterScreen — 注册成功', () => {
  it('注册成功后调用 router.replace("/")', async () => {
    mockRegister.mockResolvedValueOnce({
      id: 'uuid-1',
      email: 'test@example.com',
      nickname: '小明',
    });

    render(<RegisterScreen />);
    const emailInput = screen.getByTestId('register-email');
    const nicknameInput = screen.getByTestId('register-nickname');
    const passwordInput = screen.getByTestId('register-password');
    const privacyCheckbox = screen.getByTestId('register-privacy-checkbox');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(nicknameInput, { target: { value: '小明' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(privacyCheckbox);

    const submitButton = screen.getByTestId('register-submit');
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        'test@example.com',
        '小明',
        'password123',
        true
      );
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });
  });
});

describe('RegisterScreen — 注册失败', () => {
  it('服务端返回错误时，表单顶部显示错误信息', async () => {
    mockRegister.mockRejectedValueOnce(new Error('该邮箱已被注册'));

    render(<RegisterScreen />);
    const emailInput = screen.getByTestId('register-email');
    const nicknameInput = screen.getByTestId('register-nickname');
    const passwordInput = screen.getByTestId('register-password');
    const privacyCheckbox = screen.getByTestId('register-privacy-checkbox');

    fireEvent.change(emailInput, { target: { value: 'existing@example.com' } });
    fireEvent.change(nicknameInput, { target: { value: '小明' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(privacyCheckbox);

    const submitButton = screen.getByTestId('register-submit');
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('该邮箱已被注册')).toBeTruthy();
    });
  });

  it('网络错误时显示"网络连接失败，请稍后重试"', async () => {
    mockRegister.mockRejectedValueOnce(new Error('Network error'));

    render(<RegisterScreen />);
    const emailInput = screen.getByTestId('register-email');
    const nicknameInput = screen.getByTestId('register-nickname');
    const passwordInput = screen.getByTestId('register-password');
    const privacyCheckbox = screen.getByTestId('register-privacy-checkbox');

    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.change(nicknameInput, { target: { value: '小明' } });
    fireEvent.change(passwordInput, { target: { value: 'password123' } });
    fireEvent.click(privacyCheckbox);

    const submitButton = screen.getByTestId('register-submit');
    await act(async () => {
      fireEvent.click(submitButton);
    });

    await waitFor(() => {
      expect(screen.getByText('网络连接失败，请稍后重试')).toBeTruthy();
    });
  });
});

describe('RegisterScreen — 返回登录', () => {
  it('点击"返回登录"后调用 router.push("/login")', async () => {
    render(<RegisterScreen />);
    const goLoginButton = screen.getByTestId('register-go-login');
    fireEvent.click(goLoginButton);
    await waitFor(() => {
      expect(mockRouterPush).toHaveBeenCalledWith('/login');
    });
  });

  it('点击"返回登录"后清空邮箱输入框', async () => {
    render(<RegisterScreen />);
    const emailInput = screen.getByTestId('register-email');
    fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

    const goLoginButton = screen.getByTestId('register-go-login');
    fireEvent.click(goLoginButton);

    await waitFor(() => {
      expect(screen.getByTestId('register-email').value).toBe('');
    });
  });
});
