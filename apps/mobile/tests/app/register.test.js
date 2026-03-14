/**
 * register.test.js
 *
 * Unit tests for apps/mobile/app/register.jsx
 *
 * Uses React.createElement() to avoid requiring special .test.jsx config.
 *
 * Coverage targets:
 *  - Renders all form elements (title, email, nickname, password inputs,
 *    privacy checkbox, submit button, login link)
 *  - Email blur validation: empty, invalid format, valid clears error
 *  - Nickname blur validation: empty, too short, whitespace-only, valid
 *  - Password blur validation: empty, too short, valid
 *  - Submit full validation: blocks if any field invalid or privacy unchecked
 *  - Privacy error clears when checkbox is checked
 *  - Submit calls register() with correct args when all valid
 *  - Loading state: button shows "注册中...", inputs become disabled
 *  - Success: router.replace('/') called after successful register
 *  - Server error: displayed at form top on register() rejection
 *  - Login link: clears form and calls router.push('/login')
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const h = React.createElement;

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockRouterReplace = vi.fn();
const mockRouterPush = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    push: mockRouterPush,
  }),
}));

const mockRegister = vi.fn();

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    register: mockRegister,
  }),
}));

// Mock child components to simple HTML equivalents so tests stay fast and
// focused on page-level logic, not component internals.
vi.mock('../../components/AuthFormInput.jsx', () => ({
  AuthFormInput: ({ label, value, onChangeText, onBlur, error, editable, testID }) =>
    h('div', { 'data-testid': `${testID}-wrapper` },
      h('label', null, label),
      h('input', {
        'data-testid': testID,
        value: value || '',
        disabled: editable === false,
        onChange: (e) => onChangeText && onChangeText(e.target.value),
        onBlur: () => onBlur && onBlur(),
      }),
      error ? h('span', { 'data-testid': `${testID}-error` }, error) : null
    ),
}));

vi.mock('../../components/AuthFormError.jsx', () => ({
  AuthFormError: ({ message, testID }) =>
    message
      ? h('div', { 'data-testid': testID }, message)
      : null,
}));

vi.mock('../../components/AuthSubmitButton.jsx', () => ({
  AuthSubmitButton: ({ label, loadingLabel, loading, onPress, testID }) =>
    h('button', {
      'data-testid': testID,
      disabled: loading,
      onClick: onPress,
    }, loading ? loadingLabel : label),
}));

vi.mock('../../components/PrivacyCheckbox.jsx', () => ({
  PrivacyCheckbox: ({ checked, onChange, error, testID }) =>
    h('div', { 'data-testid': testID },
      h('button', {
        type: 'button',
        'data-testid': `${testID}-checkbox`,
        'aria-checked': Boolean(checked),
        onClick: () => onChange(!checked),
      }, checked ? 'checked' : 'unchecked'),
      error ? h('span', { 'data-testid': `${testID}-error` }, '请阅读并同意隐私协议') : null
    ),
}));

vi.mock('react-native', () => {
  function View({ children, style, testID }) {
    return h('div', { 'data-testid': testID, style }, children);
  }
  function Text({ children, style, testID }) {
    return h('span', { 'data-testid': testID, style }, children);
  }
  function ScrollView({ children, style }) {
    return h('div', { style }, children);
  }
  function TouchableOpacity({ children, onPress, testID, style }) {
    return h('button', { 'data-testid': testID, onClick: onPress, style }, children);
  }
  function KeyboardAvoidingView({ children, style }) {
    return h('div', { style }, children);
  }
  const StyleSheet = {
    create: (styles) => styles,
  };
  const Platform = { OS: 'web' };

  return { View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, StyleSheet, Platform };
});

// ---------------------------------------------------------------------------
// Module loader
// ---------------------------------------------------------------------------

async function loadRegisterScreen() {
  vi.resetModules();
  const mod = await import('../../app/register.jsx');
  return mod.default;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEmailInput() {
  return screen.getByTestId('register-email-input');
}

function getNicknameInput() {
  return screen.getByTestId('register-nickname-input');
}

function getPasswordInput() {
  return screen.getByTestId('register-password-input');
}

function getPrivacyCheckbox() {
  return screen.getByTestId('register-privacy-checkbox-checkbox');
}

function getSubmitButton() {
  return screen.getByTestId('register-submit-button');
}

function getLoginLink() {
  return screen.getByTestId('register-go-to-login');
}

/**
 * Fill all form fields and check privacy via fireEvent.
 * Must be called inside act() by the caller.
 */
function fillAllFields({ email = 'user@example.com', nickname = 'Tester', password = 'password123' } = {}) {
  fireEvent.change(getEmailInput(), { target: { value: email } });
  fireEvent.change(getNicknameInput(), { target: { value: nickname } });
  fireEvent.change(getPasswordInput(), { target: { value: password } });
  // Toggle privacy checkbox (starts unchecked, click once = checked)
  fireEvent.click(getPrivacyCheckbox());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RegisterScreen', () => {
  let RegisterScreen;

  beforeEach(async () => {
    vi.clearAllMocks();
    RegisterScreen = await loadRegisterScreen();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe('initial rendering', () => {
    it('renders the page title', () => {
      render(h(RegisterScreen, null));
      expect(screen.getByTestId('register-title')).toBeDefined();
    });

    it('renders email input', () => {
      render(h(RegisterScreen, null));
      expect(getEmailInput()).toBeDefined();
    });

    it('renders nickname input', () => {
      render(h(RegisterScreen, null));
      expect(getNicknameInput()).toBeDefined();
    });

    it('renders password input', () => {
      render(h(RegisterScreen, null));
      expect(getPasswordInput()).toBeDefined();
    });

    it('renders privacy checkbox', () => {
      render(h(RegisterScreen, null));
      expect(getPrivacyCheckbox()).toBeDefined();
    });

    it('renders submit button with label "注册"', () => {
      render(h(RegisterScreen, null));
      expect(getSubmitButton().textContent).toBe('注册');
    });

    it('renders the login navigation link', () => {
      render(h(RegisterScreen, null));
      expect(getLoginLink()).toBeDefined();
    });

    it('does not render server error banner initially', () => {
      render(h(RegisterScreen, null));
      expect(screen.queryByTestId('register-server-error')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Email blur validation
  // -------------------------------------------------------------------------

  describe('email blur validation', () => {
    it('shows error when email is empty on blur', async () => {
      render(h(RegisterScreen, null));
      await act(async () => {
        fireEvent.blur(getEmailInput());
      });
      expect(screen.getByTestId('register-email-input-error')).toBeDefined();
    });

    it('shows "请输入有效的邮箱地址" when email format is invalid on blur', async () => {
      render(h(RegisterScreen, null));
      await act(async () => {
        fireEvent.change(getEmailInput(), { target: { value: 'notanemail' } });
        fireEvent.blur(getEmailInput());
      });
      expect(screen.getByTestId('register-email-input-error').textContent).toBe('请输入有效的邮箱地址');
    });

    it('clears email error when valid email is entered and blurred', async () => {
      render(h(RegisterScreen, null));
      // Trigger error
      await act(async () => {
        fireEvent.change(getEmailInput(), { target: { value: 'bad' } });
        fireEvent.blur(getEmailInput());
      });
      expect(screen.queryByTestId('register-email-input-error')).not.toBeNull();

      // Fix the email
      await act(async () => {
        fireEvent.change(getEmailInput(), { target: { value: 'good@example.com' } });
        fireEvent.blur(getEmailInput());
      });
      expect(screen.queryByTestId('register-email-input-error')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Nickname blur validation
  // -------------------------------------------------------------------------

  describe('nickname blur validation', () => {
    it('shows error when nickname is empty on blur', async () => {
      render(h(RegisterScreen, null));
      await act(async () => {
        fireEvent.blur(getNicknameInput());
      });
      expect(screen.getByTestId('register-nickname-input-error')).toBeDefined();
    });

    it('shows error when nickname is only whitespace on blur', async () => {
      render(h(RegisterScreen, null));
      await act(async () => {
        fireEvent.change(getNicknameInput(), { target: { value: '   ' } });
        fireEvent.blur(getNicknameInput());
      });
      expect(screen.getByTestId('register-nickname-input-error')).toBeDefined();
    });

    it('shows error when nickname is shorter than 2 characters (trimmed) on blur', async () => {
      render(h(RegisterScreen, null));
      await act(async () => {
        fireEvent.change(getNicknameInput(), { target: { value: 'A' } });
        fireEvent.blur(getNicknameInput());
      });
      expect(screen.getByTestId('register-nickname-input-error').textContent).toContain('2');
    });

    it('clears nickname error when valid nickname is entered and blurred', async () => {
      render(h(RegisterScreen, null));
      await act(async () => {
        fireEvent.change(getNicknameInput(), { target: { value: 'A' } });
        fireEvent.blur(getNicknameInput());
      });
      expect(screen.queryByTestId('register-nickname-input-error')).not.toBeNull();

      await act(async () => {
        fireEvent.change(getNicknameInput(), { target: { value: 'Tester' } });
        fireEvent.blur(getNicknameInput());
      });
      expect(screen.queryByTestId('register-nickname-input-error')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Password blur validation
  // -------------------------------------------------------------------------

  describe('password blur validation', () => {
    it('shows error when password is empty on blur', async () => {
      render(h(RegisterScreen, null));
      await act(async () => {
        fireEvent.blur(getPasswordInput());
      });
      expect(screen.getByTestId('register-password-input-error')).toBeDefined();
    });

    it('shows "密码长度至少为 8 个字符" when password is too short on blur', async () => {
      render(h(RegisterScreen, null));
      await act(async () => {
        fireEvent.change(getPasswordInput(), { target: { value: 'short' } });
        fireEvent.blur(getPasswordInput());
      });
      expect(screen.getByTestId('register-password-input-error').textContent).toBe('密码长度至少为 8 个字符');
    });

    it('clears password error when valid password is entered and blurred', async () => {
      render(h(RegisterScreen, null));
      await act(async () => {
        fireEvent.change(getPasswordInput(), { target: { value: 'short' } });
        fireEvent.blur(getPasswordInput());
      });
      expect(screen.queryByTestId('register-password-input-error')).not.toBeNull();

      await act(async () => {
        fireEvent.change(getPasswordInput(), { target: { value: 'validpassword' } });
        fireEvent.blur(getPasswordInput());
      });
      expect(screen.queryByTestId('register-password-input-error')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Submit validation
  // -------------------------------------------------------------------------

  describe('submit validation', () => {
    it('does not call register() when all fields are empty', async () => {
      render(h(RegisterScreen, null));
      await act(async () => {
        fireEvent.click(getSubmitButton());
      });
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('shows email error when email is invalid on submit', async () => {
      render(h(RegisterScreen, null));
      await act(async () => {
        fireEvent.change(getEmailInput(), { target: { value: 'bad' } });
        fireEvent.change(getNicknameInput(), { target: { value: 'Tester' } });
        fireEvent.change(getPasswordInput(), { target: { value: 'password123' } });
        fireEvent.click(getPrivacyCheckbox());
      });
      await act(async () => {
        fireEvent.click(getSubmitButton());
      });
      expect(screen.getByTestId('register-email-input-error')).toBeDefined();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('shows privacy error when privacy is not checked on submit', async () => {
      render(h(RegisterScreen, null));
      await act(async () => {
        fireEvent.change(getEmailInput(), { target: { value: 'user@example.com' } });
        fireEvent.change(getNicknameInput(), { target: { value: 'Tester' } });
        fireEvent.change(getPasswordInput(), { target: { value: 'password123' } });
        // Do NOT check privacy
      });
      await act(async () => {
        fireEvent.click(getSubmitButton());
      });
      expect(screen.getByTestId('register-privacy-checkbox-error')).toBeDefined();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('clears privacy error when checkbox becomes checked after submit failure', async () => {
      render(h(RegisterScreen, null));
      // Submit without checking privacy to trigger privacy error
      await act(async () => {
        fireEvent.change(getEmailInput(), { target: { value: 'user@example.com' } });
        fireEvent.change(getNicknameInput(), { target: { value: 'Tester' } });
        fireEvent.change(getPasswordInput(), { target: { value: 'password123' } });
      });
      await act(async () => {
        fireEvent.click(getSubmitButton());
      });
      // Privacy error visible
      expect(screen.queryByTestId('register-privacy-checkbox-error')).not.toBeNull();

      // Now click the checkbox (starts unchecked, one click = checked)
      await act(async () => {
        fireEvent.click(getPrivacyCheckbox());
      });
      // Privacy error should be cleared
      expect(screen.queryByTestId('register-privacy-checkbox-error')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Successful submission
  // -------------------------------------------------------------------------

  describe('successful submission', () => {
    it('calls register() with trimmed email, nickname, password, and a timestamp', async () => {
      mockRegister.mockResolvedValue({ id: '1', email: 'user@example.com', nickname: 'Tester' });
      render(h(RegisterScreen, null));

      await act(async () => {
        fillAllFields({ email: 'user@example.com', nickname: '  Tester  ', password: 'password123' });
      });

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      expect(mockRegister).toHaveBeenCalledTimes(1);
      const [email, nickname, password] = mockRegister.mock.calls[0];
      expect(email).toBe('user@example.com');
      expect(nickname).toBe('Tester'); // trimmed
      expect(password).toBe('password123');
    });

    it('calls router.replace("/") after successful register', async () => {
      mockRegister.mockResolvedValue({ id: '1', email: 'user@example.com', nickname: 'Tester' });
      render(h(RegisterScreen, null));

      await act(async () => {
        fillAllFields();
      });

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/'));
    });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe('loading state', () => {
    it('shows "注册中..." on the button while loading', async () => {
      let resolveRegister;
      mockRegister.mockImplementation(
        () => new Promise((resolve) => { resolveRegister = resolve; })
      );

      render(h(RegisterScreen, null));

      await act(async () => {
        fillAllFields();
      });

      act(() => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getSubmitButton().textContent).toBe('注册中...');
      });

      // Resolve to avoid open handle
      await act(async () => {
        resolveRegister({ id: '1' });
      });
    });

    it('disables the submit button while loading', async () => {
      let resolveRegister;
      mockRegister.mockImplementation(
        () => new Promise((resolve) => { resolveRegister = resolve; })
      );

      render(h(RegisterScreen, null));

      await act(async () => {
        fillAllFields();
      });

      act(() => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getSubmitButton().disabled).toBe(true);
      });

      await act(async () => {
        resolveRegister({ id: '1' });
      });
    });

    it('disables inputs while loading', async () => {
      let resolveRegister;
      mockRegister.mockImplementation(
        () => new Promise((resolve) => { resolveRegister = resolve; })
      );

      render(h(RegisterScreen, null));

      await act(async () => {
        fillAllFields();
      });

      act(() => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getEmailInput().disabled).toBe(true);
        expect(getNicknameInput().disabled).toBe(true);
        expect(getPasswordInput().disabled).toBe(true);
      });

      await act(async () => {
        resolveRegister({ id: '1' });
      });
    });
  });

  // -------------------------------------------------------------------------
  // Server error handling
  // -------------------------------------------------------------------------

  describe('server error handling', () => {
    it('displays server error message on register() rejection', async () => {
      const err = new Error('该邮箱已被注册');
      err.status = 409;
      mockRegister.mockRejectedValue(err);

      render(h(RegisterScreen, null));

      await act(async () => {
        fillAllFields();
      });

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByTestId('register-server-error').textContent).toBe('该邮箱已被注册');
      });
    });

    it('restores button and inputs after server error', async () => {
      const err = new Error('该邮箱已被注册');
      err.status = 409;
      mockRegister.mockRejectedValue(err);

      render(h(RegisterScreen, null));

      await act(async () => {
        fillAllFields();
      });

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getSubmitButton().disabled).toBe(false);
        expect(getEmailInput().disabled).toBe(false);
      });
    });

    it('does not call router.replace on failure', async () => {
      const err = new Error('该邮箱已被注册');
      err.status = 409;
      mockRegister.mockRejectedValue(err);

      render(h(RegisterScreen, null));

      await act(async () => {
        fillAllFields();
      });

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByTestId('register-server-error')).toBeDefined();
      });

      expect(mockRouterReplace).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Navigation to login
  // -------------------------------------------------------------------------

  describe('navigation to login', () => {
    it('calls router.push("/login") when login link is clicked', () => {
      render(h(RegisterScreen, null));
      fireEvent.click(getLoginLink());
      expect(mockRouterPush).toHaveBeenCalledWith('/login');
    });

    it('clears form fields when login link is clicked', async () => {
      render(h(RegisterScreen, null));
      await act(async () => {
        fireEvent.change(getEmailInput(), { target: { value: 'user@example.com' } });
        fireEvent.change(getNicknameInput(), { target: { value: 'Tester' } });
        fireEvent.change(getPasswordInput(), { target: { value: 'password123' } });
      });
      await act(async () => {
        fireEvent.click(getLoginLink());
      });
      // After reset, input values should be empty strings
      expect(getEmailInput().value).toBe('');
      expect(getNicknameInput().value).toBe('');
      expect(getPasswordInput().value).toBe('');
    });

    it('clears server error when login link is clicked', async () => {
      const err = new Error('该邮箱已被注册');
      err.status = 409;
      mockRegister.mockRejectedValue(err);

      render(h(RegisterScreen, null));

      await act(async () => {
        fillAllFields();
      });

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByTestId('register-server-error')).toBeDefined();
      });

      await act(async () => {
        fireEvent.click(getLoginLink());
      });
      expect(screen.queryByTestId('register-server-error')).toBeNull();
    });
  });
});
