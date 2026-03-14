/**
 * TDD Test: apps/mobile/app/register.jsx
 * Task T014 - 实现注册页面
 *
 * Tests cover:
 * 1. 渲染测试：验证所有表单元素是否正确渲染
 *    （邮箱/昵称/密码输入框、隐私协议复选框、注册按钮、返回登录链接）
 * 2. 字段级验证：
 *    - 邮箱失焦时触发格式验证（正则 /^[^\s@]+@[^\s@]+\.[^\s@]+$/）
 *    - 昵称失焦时触发长度验证（trim 后 2-20 字符，不允许纯空格）
 *    - 密码失焦时触发长度验证（8-20 字符）
 * 3. 提交前全量校验：所有字段必须通过验证，隐私协议必须勾选
 * 4. 提交加载状态：loading 时所有输入框禁用
 * 5. 成功提交：调用 useAuth().register() 后跳转到 '/'
 * 6. 失败提交：显示服务端错误信息
 * 7. 返回登录：清空表单并跳转到 '/login'
 *
 * Mock 策略:
 * - vi.mock('../../context/AuthContext.jsx') — mock useAuth
 * - vi.mock('expo-router') — mock useRouter
 * - vi.mock('react-native') — mock RN 原生组件为 HTML 元素
 * - vi.mock 各子组件：AuthFormInput、AuthFormError、AuthSubmitButton、PrivacyCheckbox
 *
 * 测试框架: Vitest (globals: true, environment: jsdom)
 * 注意：register() 调用签名为 register(email, nickname, password, true)
 *       第四个参数为布尔值 true，表示已同意隐私协议（后端记录时间戳）
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

const mockRegister = vi.fn();

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: vi.fn(() => ({
    register: mockRegister,
  })),
}));

// ── Mock sub-components ───────────────────────────────────────────────────────
// Mocking the four components lets us:
//   - isolate register.jsx page logic from component internals
//   - control testID placement to match what the page passes
//   - simulate interactions (blur, change, click) in a jsdom environment

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

vi.mock('../../components/PrivacyCheckbox.jsx', () => {
  const ReactLib = require('react');
  return {
    PrivacyCheckbox: ({ checked, onChange, error, testID }) =>
      ReactLib.createElement(
        'div',
        {},
        ReactLib.createElement('button', {
          'data-testid': testID,
          type: 'button',
          onClick: () => onChange(!checked),
        }, checked ? '已勾选' : '未勾选'),
        checked
          ? ReactLib.createElement('span', { 'data-testid': 'checkbox-checked-icon' }, '✓')
          : null,
        error
          ? ReactLib.createElement('span', { 'data-testid': 'privacy-error' }, '请阅读并同意隐私协议')
          : null
      ),
  };
});

// ── Import component under test ───────────────────────────────────────────────
// Placed after all mocks so vi.mock hoisting picks them up correctly.

import RegisterScreen from '../../app/register.jsx';

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderRegister() {
  return render(React.createElement(RegisterScreen));
}

/**
 * Fill email, nickname and password fields with valid values.
 * Does NOT check the privacy checkbox.
 */
function fillValidFields(getByTestId) {
  fireEvent.change(getByTestId('email-input'), {
    target: { value: 'user@example.com' },
  });
  fireEvent.change(getByTestId('nickname-input'), {
    target: { value: '测试用户' },
  });
  fireEvent.change(getByTestId('password-input'), {
    target: { value: 'password123' },
  });
}

/**
 * Fill all fields AND toggle the privacy checkbox so it is checked.
 */
function fillValidFieldsAndCheckPrivacy(getByTestId) {
  fillValidFields(getByTestId);
  // The PrivacyCheckbox mock renders a <button> that calls onChange(!checked).
  // Initial state: checked=false → clicking calls onChange(true).
  fireEvent.click(getByTestId('privacy-checkbox'));
}

// ── Setup / Teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockRegister.mockResolvedValue({
    id: 'u1',
    email: 'user@example.com',
    nickname: '测试用户',
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// 1. 渲染测试
// ═════════════════════════════════════════════════════════════════════════════

describe('RegisterScreen — 渲染测试', () => {
  it('应渲染邮箱输入框', () => {
    const { getByTestId } = renderRegister();
    expect(getByTestId('email-input')).toBeTruthy();
  });

  it('应渲染昵称输入框', () => {
    const { getByTestId } = renderRegister();
    expect(getByTestId('nickname-input')).toBeTruthy();
  });

  it('应渲染密码输入框', () => {
    const { getByTestId } = renderRegister();
    expect(getByTestId('password-input')).toBeTruthy();
  });

  it('密码输入框应为 type="password"', () => {
    const { getByTestId } = renderRegister();
    expect(getByTestId('password-input').type).toBe('password');
  });

  it('应渲染隐私协议复选框', () => {
    const { getByTestId } = renderRegister();
    expect(getByTestId('privacy-checkbox')).toBeTruthy();
  });

  it('应渲染注册提交按钮', () => {
    const { getByTestId } = renderRegister();
    expect(getByTestId('register-submit-button')).toBeTruthy();
  });

  it('注册按钮初始应显示"注册"文字', () => {
    const { getByTestId } = renderRegister();
    expect(getByTestId('register-submit-button').textContent).toBe('注册');
  });

  it('应渲染返回登录链接', () => {
    const { getByTestId } = renderRegister();
    expect(getByTestId('go-to-login-link')).toBeTruthy();
  });

  it('邮箱输入框初始值应为空字符串', () => {
    const { getByTestId } = renderRegister();
    expect(getByTestId('email-input').value).toBe('');
  });

  it('昵称输入框初始值应为空字符串', () => {
    const { getByTestId } = renderRegister();
    expect(getByTestId('nickname-input').value).toBe('');
  });

  it('密码输入框初始值应为空字符串', () => {
    const { getByTestId } = renderRegister();
    expect(getByTestId('password-input').value).toBe('');
  });

  it('隐私协议复选框初始应未勾选', () => {
    const { queryByTestId } = renderRegister();
    expect(queryByTestId('checkbox-checked-icon')).toBeNull();
  });

  it('初始不应显示表单顶部服务端错误', () => {
    const { queryByTestId } = renderRegister();
    expect(queryByTestId('form-error')).toBeNull();
  });

  it('初始不应显示字段错误提示', () => {
    const { container } = renderRegister();
    const errors = container.querySelectorAll('[data-testid="input-error"]');
    expect(errors.length).toBe(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. 字段级验证测试
// ═════════════════════════════════════════════════════════════════════════════

describe('RegisterScreen — 邮箱字段级验证', () => {
  it('邮箱失焦且为空时应显示错误提示', () => {
    const { getByTestId, container } = renderRegister();
    fireEvent.blur(getByTestId('email-input'));
    const emailWrapper = getByTestId('email-input-wrapper');
    const error = emailWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeTruthy();
  });

  it('邮箱失焦且格式非法（无@符号）时应显示错误', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('email-input'), {
      target: { value: 'notanemail' },
    });
    fireEvent.blur(getByTestId('email-input'));
    const emailWrapper = getByTestId('email-input-wrapper');
    const error = emailWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeTruthy();
  });

  it('邮箱失焦且格式非法（无域名部分）时应显示错误', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('email-input'), {
      target: { value: 'user@' },
    });
    fireEvent.blur(getByTestId('email-input'));
    const emailWrapper = getByTestId('email-input-wrapper');
    const error = emailWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeTruthy();
  });

  it('邮箱失焦且格式合法时不应显示邮箱错误', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('email-input'), {
      target: { value: 'valid@example.com' },
    });
    fireEvent.blur(getByTestId('email-input'));
    const emailWrapper = getByTestId('email-input-wrapper');
    const error = emailWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeNull();
  });

  it('有效邮箱满足正则 /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/', () => {
    const validEmails = ['user@example.com', 'test.user@domain.org', 'a@b.co'];
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    validEmails.forEach((email) => {
      expect(regex.test(email)).toBe(true);
    });
  });

  it('无效邮箱不满足正则 /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/', () => {
    const invalidEmails = ['notanemail', 'user@', '@domain.com', ''];
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    invalidEmails.forEach((email) => {
      expect(regex.test(email)).toBe(false);
    });
  });
});

describe('RegisterScreen — 昵称字段级验证', () => {
  it('昵称失焦且为空时应显示错误提示', () => {
    const { getByTestId } = renderRegister();
    fireEvent.blur(getByTestId('nickname-input'));
    const nicknameWrapper = getByTestId('nickname-input-wrapper');
    const error = nicknameWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeTruthy();
  });

  it('昵称失焦且仅含空格时应显示错误（不允许纯空格）', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('nickname-input'), {
      target: { value: '   ' },
    });
    fireEvent.blur(getByTestId('nickname-input'));
    const nicknameWrapper = getByTestId('nickname-input-wrapper');
    const error = nicknameWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeTruthy();
  });

  it('昵称失焦且 trim 后少于 2 字符时应显示错误', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('nickname-input'), {
      target: { value: 'A' },
    });
    fireEvent.blur(getByTestId('nickname-input'));
    const nicknameWrapper = getByTestId('nickname-input-wrapper');
    const error = nicknameWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeTruthy();
  });

  it('昵称失焦且 trim 后正好 2 字符时不应显示昵称错误', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('nickname-input'), {
      target: { value: 'AB' },
    });
    fireEvent.blur(getByTestId('nickname-input'));
    const nicknameWrapper = getByTestId('nickname-input-wrapper');
    const error = nicknameWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeNull();
  });

  it('昵称失焦且 trim 后正好 20 字符时不应显示昵称错误', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('nickname-input'), {
      target: { value: '12345678901234567890' }, // 20 chars
    });
    fireEvent.blur(getByTestId('nickname-input'));
    const nicknameWrapper = getByTestId('nickname-input-wrapper');
    const error = nicknameWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeNull();
  });

  it('昵称失焦且合法（2-20 字符）时不应显示昵称错误', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('nickname-input'), {
      target: { value: '测试用户' },
    });
    fireEvent.blur(getByTestId('nickname-input'));
    const nicknameWrapper = getByTestId('nickname-input-wrapper');
    const error = nicknameWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeNull();
  });
});

describe('RegisterScreen — 密码字段级验证', () => {
  it('密码失焦且为空时应显示错误提示', () => {
    const { getByTestId } = renderRegister();
    fireEvent.blur(getByTestId('password-input'));
    const passwordWrapper = getByTestId('password-input-wrapper');
    const error = passwordWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeTruthy();
  });

  it('密码失焦且少于 8 字符时应显示错误', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('password-input'), {
      target: { value: 'short' },
    });
    fireEvent.blur(getByTestId('password-input'));
    const passwordWrapper = getByTestId('password-input-wrapper');
    const error = passwordWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeTruthy();
  });

  it('密码失焦且正好 8 字符时不应显示密码错误', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('password-input'), {
      target: { value: '12345678' },
    });
    fireEvent.blur(getByTestId('password-input'));
    const passwordWrapper = getByTestId('password-input-wrapper');
    const error = passwordWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeNull();
  });

  it('密码失焦且超过 20 字符时应显示错误', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('password-input'), {
      target: { value: '123456789012345678901' }, // 21 chars
    });
    fireEvent.blur(getByTestId('password-input'));
    const passwordWrapper = getByTestId('password-input-wrapper');
    const error = passwordWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeTruthy();
  });

  it('密码失焦且正好 20 字符时不应显示密码错误', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('password-input'), {
      target: { value: '12345678901234567890' }, // 20 chars
    });
    fireEvent.blur(getByTestId('password-input'));
    const passwordWrapper = getByTestId('password-input-wrapper');
    const error = passwordWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeNull();
  });

  it('密码失焦且长度在 8-20 之间时不应显示密码错误', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('password-input'), {
      target: { value: 'password123' },
    });
    fireEvent.blur(getByTestId('password-input'));
    const passwordWrapper = getByTestId('password-input-wrapper');
    const error = passwordWrapper.querySelector('[data-testid="input-error"]');
    expect(error).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. 提交前全量校验
// ═════════════════════════════════════════════════════════════════════════════

describe('RegisterScreen — 提交前全量校验', () => {
  it('所有字段为空时点击注册按钮不应调用 register()', () => {
    const { getByTestId } = renderRegister();
    fireEvent.click(getByTestId('register-submit-button'));
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('邮箱非法时点击注册按钮不应调用 register()', async () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('email-input'), {
      target: { value: 'invalid-email' },
    });
    fireEvent.change(getByTestId('nickname-input'), {
      target: { value: '测试用户' },
    });
    fireEvent.change(getByTestId('password-input'), {
      target: { value: 'password123' },
    });
    fireEvent.click(getByTestId('privacy-checkbox')); // toggle: false → true
    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('昵称为纯空格时点击注册按钮不应调用 register()', async () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('email-input'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(getByTestId('nickname-input'), {
      target: { value: '   ' },
    });
    fireEvent.change(getByTestId('password-input'), {
      target: { value: 'password123' },
    });
    fireEvent.click(getByTestId('privacy-checkbox'));
    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('密码少于 8 字符时点击注册按钮不应调用 register()', async () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('email-input'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(getByTestId('nickname-input'), {
      target: { value: '测试用户' },
    });
    fireEvent.change(getByTestId('password-input'), {
      target: { value: 'short' },
    });
    fireEvent.click(getByTestId('privacy-checkbox'));
    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('未勾选隐私协议时点击注册按钮不应调用 register()', async () => {
    const { getByTestId } = renderRegister();
    fillValidFields(getByTestId);
    // Do NOT click the privacy checkbox
    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('未勾选隐私协议提交时应显示隐私协议错误', async () => {
    const { getByTestId, getByText } = renderRegister();
    fillValidFields(getByTestId);
    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });
    expect(getByText('请阅读并同意隐私协议')).toBeTruthy();
  });

  it('字段校验失败时应展示字段级错误提示', async () => {
    const { getByTestId, container } = renderRegister();
    // Submit with empty fields
    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });
    const errors = container.querySelectorAll('[data-testid="input-error"]');
    expect(errors.length).toBeGreaterThan(0);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. 提交加载状态
// ═════════════════════════════════════════════════════════════════════════════

describe('RegisterScreen — 提交加载状态', () => {
  it('提交期间注册按钮应显示"注册中..."文字', async () => {
    // Never resolves so we can inspect the loading state
    let resolveRegister;
    mockRegister.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegister = resolve;
        })
    );

    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    // Start the submit but don't await so we can check mid-flight state
    act(() => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    // Immediately after starting the async submit, loading should be true
    expect(getByTestId('register-submit-button').textContent).toBe('注册中...');

    // Cleanup: resolve the promise
    await act(async () => {
      resolveRegister({ id: 'u1' });
    });
  });

  it('提交期间注册按钮应被禁用', async () => {
    let resolveRegister;
    mockRegister.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegister = resolve;
        })
    );

    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    act(() => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(getByTestId('register-submit-button').disabled).toBe(true);

    await act(async () => {
      resolveRegister({ id: 'u1' });
    });
  });

  it('提交期间邮箱输入框应被禁用（readOnly）', async () => {
    let resolveRegister;
    mockRegister.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegister = resolve;
        })
    );

    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    act(() => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(getByTestId('email-input').readOnly).toBe(true);

    await act(async () => {
      resolveRegister({ id: 'u1' });
    });
  });

  it('提交期间昵称输入框应被禁用（readOnly）', async () => {
    let resolveRegister;
    mockRegister.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegister = resolve;
        })
    );

    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    act(() => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(getByTestId('nickname-input').readOnly).toBe(true);

    await act(async () => {
      resolveRegister({ id: 'u1' });
    });
  });

  it('提交期间密码输入框应被禁用（readOnly）', async () => {
    let resolveRegister;
    mockRegister.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegister = resolve;
        })
    );

    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    act(() => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(getByTestId('password-input').readOnly).toBe(true);

    await act(async () => {
      resolveRegister({ id: 'u1' });
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. 成功提交
// ═════════════════════════════════════════════════════════════════════════════

describe('RegisterScreen — 成功提交', () => {
  it('所有字段有效且勾选隐私协议时应调用 register()', async () => {
    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(mockRegister).toHaveBeenCalledTimes(1);
  });

  it('应以 (email, nickname, password, true) 调用 register()', async () => {
    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(mockRegister).toHaveBeenCalledWith(
      'user@example.com',
      '测试用户',
      'password123',
      true
    );
  });

  it('register() 第四个参数必须是布尔值 true（而非时间戳）', async () => {
    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    const [, , , agreedToPrivacy] = mockRegister.mock.calls[0];
    expect(agreedToPrivacy).toBe(true);
    expect(typeof agreedToPrivacy).toBe('boolean');
  });

  it('注册成功后应调用 router.replace("/")', async () => {
    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(mockReplace).toHaveBeenCalledWith('/');
  });

  it('注册成功后不应调用 router.push()', async () => {
    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('注册成功后按钮应恢复可用状态（loading=false）', async () => {
    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(getByTestId('register-submit-button').disabled).toBe(false);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. 失败提交 — 显示服务端错误信息
// ═════════════════════════════════════════════════════════════════════════════

describe('RegisterScreen — 失败提交', () => {
  it('register() 抛出错误时应在表单顶部显示错误信息', async () => {
    mockRegister.mockRejectedValue(new Error('该邮箱已被注册'));

    const { getByTestId, getByText } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(getByText('该邮箱已被注册')).toBeTruthy();
  });

  it('网络错误时应显示对应的服务端错误信息', async () => {
    mockRegister.mockRejectedValue(new Error('网络连接失败，请稍后重试'));

    const { getByTestId, getByText } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(getByText('网络连接失败，请稍后重试')).toBeTruthy();
  });

  it('register() 失败后按钮应恢复可用状态', async () => {
    mockRegister.mockRejectedValue(new Error('该邮箱已被注册'));

    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(getByTestId('register-submit-button').disabled).toBe(false);
  });

  it('register() 失败后输入框应恢复可编辑状态', async () => {
    mockRegister.mockRejectedValue(new Error('该邮箱已被注册'));

    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(getByTestId('email-input').readOnly).toBe(false);
    expect(getByTestId('nickname-input').readOnly).toBe(false);
    expect(getByTestId('password-input').readOnly).toBe(false);
  });

  it('register() 失败后不应跳转', async () => {
    mockRegister.mockRejectedValue(new Error('该邮箱已被注册'));

    const { getByTestId } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('第二次提交前已有服务端错误应被清除', async () => {
    mockRegister
      .mockRejectedValueOnce(new Error('该邮箱已被注册'))
      .mockResolvedValueOnce({ id: 'u2', email: 'new@example.com', nickname: '新用户' });

    const { getByTestId, queryByText } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    // First submit → fails
    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    // Error message should be visible after first failure
    expect(queryByText('该邮箱已被注册')).toBeTruthy();

    // Second submit → succeeds; error should disappear
    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    expect(queryByText('该邮箱已被注册')).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. 返回登录
// ═════════════════════════════════════════════════════════════════════════════

describe('RegisterScreen — 返回登录', () => {
  it('点击返回登录链接应调用 router.push("/login")', () => {
    const { getByTestId } = renderRegister();
    fireEvent.click(getByTestId('go-to-login-link'));
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('点击返回登录链接不应调用 router.replace()', () => {
    const { getByTestId } = renderRegister();
    fireEvent.click(getByTestId('go-to-login-link'));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('点击返回登录后邮箱输入框应被清空', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('email-input'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(getByTestId('go-to-login-link'));
    expect(getByTestId('email-input').value).toBe('');
  });

  it('点击返回登录后昵称输入框应被清空', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('nickname-input'), {
      target: { value: '测试用户' },
    });
    fireEvent.click(getByTestId('go-to-login-link'));
    expect(getByTestId('nickname-input').value).toBe('');
  });

  it('点击返回登录后密码输入框应被清空', () => {
    const { getByTestId } = renderRegister();
    fireEvent.change(getByTestId('password-input'), {
      target: { value: 'password123' },
    });
    fireEvent.click(getByTestId('go-to-login-link'));
    expect(getByTestId('password-input').value).toBe('');
  });

  it('点击返回登录后字段级错误提示应被清除', async () => {
    const { getByTestId, container } = renderRegister();

    // Trigger validation errors via blur
    fireEvent.blur(getByTestId('email-input'));
    fireEvent.blur(getByTestId('nickname-input'));
    fireEvent.blur(getByTestId('password-input'));

    // Verify errors are showing
    expect(container.querySelectorAll('[data-testid="input-error"]').length).toBeGreaterThan(0);

    // Navigate to login
    fireEvent.click(getByTestId('go-to-login-link'));

    // All field errors should be gone
    expect(container.querySelectorAll('[data-testid="input-error"]').length).toBe(0);
  });

  it('点击返回登录后服务端错误提示应被清空', async () => {
    mockRegister.mockRejectedValue(new Error('该邮箱已被注册'));

    const { getByTestId, queryByText } = renderRegister();
    fillValidFieldsAndCheckPrivacy(getByTestId);

    await act(async () => {
      fireEvent.click(getByTestId('register-submit-button'));
    });

    // Confirm error is visible
    expect(queryByText('该邮箱已被注册')).toBeTruthy();

    // Navigate away to login
    fireEvent.click(getByTestId('go-to-login-link'));
    expect(queryByText('该邮箱已被注册')).toBeNull();
  });

  it('点击返回登录后隐私协议复选框应被重置为未勾选', () => {
    const { getByTestId, queryByTestId } = renderRegister();

    // Check the privacy checkbox first
    fireEvent.click(getByTestId('privacy-checkbox')); // false → true

    // Verify it's now checked
    expect(queryByTestId('checkbox-checked-icon')).toBeTruthy();

    // Navigate to login
    fireEvent.click(getByTestId('go-to-login-link'));

    // Should be unchecked again
    expect(queryByTestId('checkbox-checked-icon')).toBeNull();
  });
});
