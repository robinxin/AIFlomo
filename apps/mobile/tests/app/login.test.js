/**
 * TDD Test: apps/mobile/app/login.jsx
 * Task T015 - 实现登录页面
 *
 * Tests cover:
 * 1. 渲染测试：验证所有表单元素是否正确渲染
 *    （邮箱/密码输入框、登录按钮、立即注册链接）
 * 2. 表单交互测试：
 *    - 输入邮箱时更新状态
 *    - 输入密码时更新状态
 *    - 点击"立即注册"清空表单并导航到 /register
 * 3. 登录成功场景：
 *    - 按钮进入加载状态
 *    - 输入框被禁用
 *    - 调用 login(email, password)
 *    - 调用 router.replace('/')
 * 4. 登录失败场景（401）：
 *    - 表单顶部显示"邮箱或密码错误，请重试"
 *    - 密码框被清空
 *    - 邮箱框保留内容
 *    - 输入框恢复可编辑
 *    - 按钮恢复可点击
 * 5. 登录失败场景（网络错误）：
 *    - 表单顶部显示"网络连接失败，请稍后重试"
 *
 * Mock 策略:
 * - vi.mock('../../context/AuthContext.jsx') — mock useAuth
 * - vi.mock('expo-router') — mock useRouter
 * - vi.mock('react-native') — mock RN 原生组件为 HTML 元素
 * - vi.mock 各子组件：AuthFormInput、AuthFormError、AuthSubmitButton
 *
 * 测试框架: Vitest (globals: true, environment: jsdom)
 * 注意：登录页面不需要失焦实时验证（与注册页不同）
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import React from 'react';

// ── Mock react-native ────────────────────────────────────────────────────────
// Vitest hoists vi.mock() calls before imports; these run before any module loads.

vi.mock('react-native', () => {
  const ReactLib = require('react');

  const Text = ({ children, style, testID, onPress }) =>
    ReactLib.createElement(
      'span',
      { 'data-testid': testID, style, onClick: onPress },
      children
    );

  const TextInput = ({
    testID,
    onFocus,
    onBlur,
    secureTextEntry,
    editable,
    maxLength,
    keyboardType,
    value,
    onChangeText,
    style,
    placeholderTextColor: _ptc,
    ...rest
  }) =>
    ReactLib.createElement('input', {
      'data-testid': testID,
      maxLength,
      value: value || '',
      readOnly: editable === false,
      type: secureTextEntry ? 'password' : 'text',
      'data-keyboard-type': keyboardType,
      onFocus,
      onBlur,
      onChange: (e) => onChangeText && onChangeText(e.target.value),
      style,
    });

  const TouchableOpacity = ({ children, onPress, testID, style, disabled }) =>
    ReactLib.createElement(
      'button',
      {
        'data-testid': testID,
        onClick: disabled ? undefined : onPress,
        disabled,
        style,
      },
      children
    );

  const View = ({ children, style, testID }) =>
    ReactLib.createElement('div', { 'data-testid': testID, style }, children);

  const ScrollView = ({ children, style, testID }) =>
    ReactLib.createElement('div', { 'data-testid': testID, style }, children);

  return {
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ScrollView,
    Platform: { OS: 'web', select: (obj) => obj.web ?? obj.default },
    StyleSheet: { create: (s) => s },
  };
});

// ── Mock expo-router ──────────────────────────────────────────────────────────

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: vi.fn(() => ({
    replace: mockReplace,
    push: mockPush,
  })),
}));

// ── Mock AuthContext ──────────────────────────────────────────────────────────

const mockLogin = vi.fn();

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: vi.fn(() => ({
    login: mockLogin,
  })),
}));

// ── Mock sub-components ───────────────────────────────────────────────────────
// Mocking the three components lets us:
//   - isolate login.jsx page logic from component internals
//   - control testID placement to match what the page passes
//   - simulate interactions (change, click) in a jsdom environment

vi.mock('../../components/AuthFormInput.jsx', () => {
  const ReactLib = require('react');
  return {
    AuthFormInput: ({
      label,
      value,
      onChangeText,
      onBlur,
      error,
      secureTextEntry,
      editable,
      keyboardType,
      maxLength,
      testID,
    }) =>
      ReactLib.createElement(
        'div',
        { 'data-testid': testID ? `${testID}-wrapper` : undefined },
        ReactLib.createElement('label', {}, label),
        ReactLib.createElement('input', {
          'data-testid': testID,
          value: value || '',
          readOnly: editable === false,
          type: secureTextEntry ? 'password' : 'text',
          maxLength,
          'data-keyboard-type': keyboardType,
          onChange: (e) => onChangeText && onChangeText(e.target.value),
          onBlur: () => onBlur && onBlur(),
        }),
        error
          ? ReactLib.createElement('span', { 'data-testid': 'input-error' }, error)
          : null
      ),
  };
});

vi.mock('../../components/AuthFormError.jsx', () => {
  const ReactLib = require('react');
  return {
    AuthFormError: ({ message, testID }) =>
      message
        ? ReactLib.createElement('div', { 'data-testid': testID || 'form-error' }, message)
        : null,
  };
});

vi.mock('../../components/AuthSubmitButton.jsx', () => {
  const ReactLib = require('react');
  return {
    AuthSubmitButton: ({ label, loadingLabel, loading, onPress, disabled, testID }) =>
      ReactLib.createElement(
        'button',
        {
          'data-testid': testID,
          disabled: loading || disabled,
          onClick: loading || disabled ? undefined : onPress,
        },
        loading ? loadingLabel : label
      ),
  };
});

// ── Import component under test ───────────────────────────────────────────────
// Placed after all mocks so vi.mock hoisting picks them up correctly.

import LoginScreen from '../../app/login.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderLogin() {
  return render(React.createElement(LoginScreen));
}

/**
 * Fill email and password fields with valid values.
 */
function fillValidFields(getByTestId) {
  fireEvent.change(getByTestId('email-input'), {
    target: { value: 'user@example.com' },
  });
  fireEvent.change(getByTestId('password-input'), {
    target: { value: 'password123' },
  });
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockLogin.mockResolvedValue({
    id: 'u1',
    email: 'user@example.com',
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ══════════════════════════════════════════════════════════════════════════════
// 1. 渲染测试
// ══════════════════════════════════════════════════════════════════════════════

describe('LoginScreen — 渲染测试', () => {
  it('应渲染邮箱输入框（label="邮箱"）', () => {
    const { getByTestId, getByText } = renderLogin();
    expect(getByTestId('email-input')).toBeTruthy();
    expect(getByText('邮箱')).toBeTruthy();
  });

  it('应渲染密码输入框（label="密码"）', () => {
    const { getByTestId, getByText } = renderLogin();
    expect(getByTestId('password-input')).toBeTruthy();
    expect(getByText('密码')).toBeTruthy();
  });

  it('密码输入框应为 secureTextEntry（type="password"）', () => {
    const { getByTestId } = renderLogin();
    expect(getByTestId('password-input').type).toBe('password');
  });

  it('应渲染"登录"提交按钮', () => {
    const { getByTestId } = renderLogin();
    expect(getByTestId('login-submit-button')).toBeTruthy();
  });

  it('登录按钮初始应显示"登录"文字', () => {
    const { getByTestId } = renderLogin();
    expect(getByTestId('login-submit-button').textContent).toBe('登录');
  });

  it('应渲染"没有账号？立即注册"链接', () => {
    const { getByTestId } = renderLogin();
    expect(getByTestId('go-to-register-link')).toBeTruthy();
  });

  it('邮箱输入框初始值应为空字符串', () => {
    const { getByTestId } = renderLogin();
    expect(getByTestId('email-input').value).toBe('');
  });

  it('密码输入框初始值应为空字符串', () => {
    const { getByTestId } = renderLogin();
    expect(getByTestId('password-input').value).toBe('');
  });

  it('初始不应显示表单顶部服务端错误', () => {
    const { queryByTestId } = renderLogin();
    expect(queryByTestId('form-error')).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 2. 表单交互测试
// ══════════════════════════════════════════════════════════════════════════════

describe('LoginScreen — 表单交互测试', () => {
  it('输入邮箱时邮箱 state 应更新', () => {
    const { getByTestId } = renderLogin();
    fireEvent.change(getByTestId('email-input'), {
      target: { value: 'test@example.com' },
    });
    expect(getByTestId('email-input').value).toBe('test@example.com');
  });

  it('输入密码时密码 state 应更新', () => {
    const { getByTestId } = renderLogin();
    fireEvent.change(getByTestId('password-input'), {
      target: { value: 'mypassword' },
    });
    expect(getByTestId('password-input').value).toBe('mypassword');
  });

  it('点击"立即注册"应清空邮箱输入框', () => {
    const { getByTestId } = renderLogin();
    fireEvent.change(getByTestId('email-input'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(getByTestId('go-to-register-link'));
    expect(getByTestId('email-input').value).toBe('');
  });

  it('点击"立即注册"应清空密码输入框', () => {
    const { getByTestId } = renderLogin();
    fireEvent.change(getByTestId('password-input'), {
      target: { value: 'password123' },
    });
    fireEvent.click(getByTestId('go-to-register-link'));
    expect(getByTestId('password-input').value).toBe('');
  });

  it('点击"立即注册"应调用 router.push("/register")', () => {
    const { getByTestId } = renderLogin();
    fireEvent.click(getByTestId('go-to-register-link'));
    expect(mockPush).toHaveBeenCalledWith('/register');
  });

  it('点击"立即注册"不应调用 router.replace()', () => {
    const { getByTestId } = renderLogin();
    fireEvent.click(getByTestId('go-to-register-link'));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('点击"立即注册"后应清除表单顶部错误', async () => {
    // 先制造一个服务端错误
    mockLogin.mockRejectedValue(Object.assign(new Error('邮箱或密码错误，请重试'), { status: 401 }));

    const { getByTestId, queryByTestId } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    // 确认错误已显示
    expect(queryByTestId('form-error')).toBeTruthy();

    // 点击注册链接，错误应被清除
    fireEvent.click(getByTestId('go-to-register-link'));
    expect(queryByTestId('form-error')).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 3. 登录成功场景
// ══════════════════════════════════════════════════════════════════════════════

describe('LoginScreen — 登录成功场景', () => {
  it('点击登录按钮应进入加载状态，按钮文字变为"登录中..."', async () => {
    let resolveLogin;
    mockLogin.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );

    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    act(() => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    // 提交开始后立即检查加载状态
    expect(getByTestId('login-submit-button').textContent).toBe('登录中...');

    // Cleanup
    await act(async () => {
      resolveLogin({ id: 'u1' });
    });
  });

  it('提交期间登录按钮应被禁用', async () => {
    let resolveLogin;
    mockLogin.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );

    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    act(() => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(getByTestId('login-submit-button').disabled).toBe(true);

    await act(async () => {
      resolveLogin({ id: 'u1' });
    });
  });

  it('提交期间邮箱输入框应被禁用（editable=false → readOnly）', async () => {
    let resolveLogin;
    mockLogin.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );

    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    act(() => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(getByTestId('email-input').readOnly).toBe(true);

    await act(async () => {
      resolveLogin({ id: 'u1' });
    });
  });

  it('提交期间密码输入框应被禁用（editable=false → readOnly）', async () => {
    let resolveLogin;
    mockLogin.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );

    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    act(() => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(getByTestId('password-input').readOnly).toBe(true);

    await act(async () => {
      resolveLogin({ id: 'u1' });
    });
  });

  it('应以 (email, password) 调用 login()', async () => {
    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'password123');
  });

  it('登录成功后应调用 router.replace("/")', async () => {
    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('登录成功后不应调用 router.push()', async () => {
    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('登录成功后提交期间的错误清除逻辑应将表单顶部错误清空', async () => {
    // 先失败，再成功，验证第二次提交前清除了错误
    mockLogin
      .mockRejectedValueOnce(Object.assign(new Error('邮箱或密码错误，请重试'), { status: 401 }))
      .mockResolvedValueOnce({ id: 'u1' });

    const { getByTestId, queryByTestId } = renderLogin();
    fillValidFields(getByTestId);

    // 第一次提交失败
    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(queryByTestId('form-error')).toBeTruthy();

    // 第二次提交成功，错误消失
    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(queryByTestId('form-error')).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 4. 登录失败场景（401）
// ══════════════════════════════════════════════════════════════════════════════

describe('LoginScreen — 登录失败场景（401）', () => {
  function make401Error() {
    const err = new Error('邮箱或密码错误，请重试');
    err.status = 401;
    return err;
  }

  it('401 错误时表单顶部应显示"邮箱或密码错误，请重试"', async () => {
    mockLogin.mockRejectedValue(make401Error());

    const { getByTestId, getByText } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(getByText('邮箱或密码错误，请重试')).toBeTruthy();
  });

  it('401 错误时密码框应被清空（value=""）', async () => {
    mockLogin.mockRejectedValue(make401Error());

    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(getByTestId('password-input').value).toBe('');
  });

  it('401 错误时邮箱框应保留原内容', async () => {
    mockLogin.mockRejectedValue(make401Error());

    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(getByTestId('email-input').value).toBe('user@example.com');
  });

  it('401 错误后邮箱输入框应恢复可编辑状态', async () => {
    mockLogin.mockRejectedValue(make401Error());

    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(getByTestId('email-input').readOnly).toBe(false);
  });

  it('401 错误后密码输入框应恢复可编辑状态', async () => {
    mockLogin.mockRejectedValue(make401Error());

    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(getByTestId('password-input').readOnly).toBe(false);
  });

  it('401 错误后按钮应恢复可点击状态', async () => {
    mockLogin.mockRejectedValue(make401Error());

    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(getByTestId('login-submit-button').disabled).toBe(false);
  });

  it('401 错误后不应跳转', async () => {
    mockLogin.mockRejectedValue(make401Error());

    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// 5. 登录失败场景（网络错误）
// ══════════════════════════════════════════════════════════════════════════════

describe('LoginScreen — 登录失败场景（网络错误）', () => {
  it('网络错误时应显示"网络连接失败，请稍后重试"', async () => {
    mockLogin.mockRejectedValue(new Error('网络连接失败，请稍后重试'));

    const { getByTestId, getByText } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(getByText('网络连接失败，请稍后重试')).toBeTruthy();
  });

  it('网络错误后按钮应恢复可点击状态', async () => {
    mockLogin.mockRejectedValue(new Error('网络连接失败，请稍后重试'));

    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(getByTestId('login-submit-button').disabled).toBe(false);
  });

  it('网络错误后输入框应恢复可编辑状态', async () => {
    mockLogin.mockRejectedValue(new Error('网络连接失败，请稍后重试'));

    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(getByTestId('email-input').readOnly).toBe(false);
    expect(getByTestId('password-input').readOnly).toBe(false);
  });

  it('网络错误后不应跳转', async () => {
    mockLogin.mockRejectedValue(new Error('网络连接失败，请稍后重试'));

    const { getByTestId } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('未知错误时应显示通用错误提示', async () => {
    mockLogin.mockRejectedValue(new Error('服务器内部错误'));

    const { getByTestId, getByText } = renderLogin();
    fillValidFields(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('login-submit-button'));
    });

    expect(getByText('服务器内部错误')).toBeTruthy();
  });
});
