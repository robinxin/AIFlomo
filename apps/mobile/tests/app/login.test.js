/**
 * login.test.js
 *
 * Unit tests for apps/mobile/app/login.jsx
 *
 * Uses React.createElement() to avoid requiring special .test.jsx config.
 *
 * Coverage targets:
 *  - Renders all form elements (title, email input, password input, submit button, register link)
 *  - No blur-time validation on login page
 *  - Submit: calls login() with email and password
 *  - Loading state: button shows "登录中...", inputs become disabled
 *  - Success: router.replace('/') called
 *  - 401 failure: shows "邮箱或密码错误，请重试", clears password, keeps email
 *  - Network/other failure: shows error message from thrown error
 *  - Register link: clears form and calls router.push('/register')
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

const mockLogin = vi.fn();

vi.mock('../../context/AuthContext.jsx', () => ({
  useAuth: () => ({
    login: mockLogin,
  }),
}));

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

async function loadLoginScreen() {
  vi.resetModules();
  const mod = await import('../../app/login.jsx');
  return mod.default;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEmailInput() {
  return screen.getByTestId('login-email-input');
}

function getPasswordInput() {
  return screen.getByTestId('login-password-input');
}

function getSubmitButton() {
  return screen.getByTestId('login-submit-button');
}

function getRegisterLink() {
  return screen.getByTestId('login-go-to-register');
}

function fillForm({ email = 'user@example.com', password = 'password123' } = {}) {
  fireEvent.change(getEmailInput(), { target: { value: email } });
  fireEvent.change(getPasswordInput(), { target: { value: password } });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LoginScreen', () => {
  let LoginScreen;

  beforeEach(async () => {
    vi.clearAllMocks();
    LoginScreen = await loadLoginScreen();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  describe('initial rendering', () => {
    it('renders the page title', () => {
      render(h(LoginScreen, null));
      expect(screen.getByTestId('login-title')).toBeDefined();
    });

    it('renders email input', () => {
      render(h(LoginScreen, null));
      expect(getEmailInput()).toBeDefined();
    });

    it('renders password input', () => {
      render(h(LoginScreen, null));
      expect(getPasswordInput()).toBeDefined();
    });

    it('renders submit button with label "登录"', () => {
      render(h(LoginScreen, null));
      expect(getSubmitButton().textContent).toBe('登录');
    });

    it('renders the register navigation link', () => {
      render(h(LoginScreen, null));
      expect(getRegisterLink()).toBeDefined();
    });

    it('does not render server error banner initially', () => {
      render(h(LoginScreen, null));
      expect(screen.queryByTestId('login-server-error')).toBeNull();
    });

    it('inputs are enabled initially', () => {
      render(h(LoginScreen, null));
      expect(getEmailInput().disabled).toBe(false);
      expect(getPasswordInput().disabled).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // No blur validation
  // -------------------------------------------------------------------------

  describe('no blur-time validation', () => {
    it('does not show email error after email blur', () => {
      render(h(LoginScreen, null));
      fireEvent.blur(getEmailInput());
      expect(screen.queryByTestId('login-email-input-error')).toBeNull();
    });

    it('does not show password error after password blur', () => {
      render(h(LoginScreen, null));
      fireEvent.blur(getPasswordInput());
      expect(screen.queryByTestId('login-password-input-error')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Submit: calls login()
  // -------------------------------------------------------------------------

  describe('submit', () => {
    it('calls login() with email and password on submit', async () => {
      mockLogin.mockResolvedValue({ id: '1', email: 'user@example.com', nickname: 'Tester' });
      render(h(LoginScreen, null));
      fillForm({ email: 'user@example.com', password: 'mypassword' });

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      expect(mockLogin).toHaveBeenCalledWith('user@example.com', 'mypassword');
    });

    it('calls login() even when fields are empty (no client-side validation)', async () => {
      mockLogin.mockResolvedValue({ id: '1' });
      render(h(LoginScreen, null));

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      expect(mockLogin).toHaveBeenCalledWith('', '');
    });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe('loading state', () => {
    it('shows "登录中..." on the button while loading', async () => {
      let resolveLogin;
      mockLogin.mockImplementation(
        () => new Promise((resolve) => { resolveLogin = resolve; })
      );

      render(h(LoginScreen, null));
      fillForm();

      act(() => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getSubmitButton().textContent).toBe('登录中...');
      });

      await act(async () => {
        resolveLogin({ id: '1' });
      });
    });

    it('disables the submit button while loading', async () => {
      let resolveLogin;
      mockLogin.mockImplementation(
        () => new Promise((resolve) => { resolveLogin = resolve; })
      );

      render(h(LoginScreen, null));
      fillForm();

      act(() => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getSubmitButton().disabled).toBe(true);
      });

      await act(async () => {
        resolveLogin({ id: '1' });
      });
    });

    it('disables inputs while loading', async () => {
      let resolveLogin;
      mockLogin.mockImplementation(
        () => new Promise((resolve) => { resolveLogin = resolve; })
      );

      render(h(LoginScreen, null));
      fillForm();

      act(() => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getEmailInput().disabled).toBe(true);
        expect(getPasswordInput().disabled).toBe(true);
      });

      await act(async () => {
        resolveLogin({ id: '1' });
      });
    });

    it('re-enables inputs after loading completes (success)', async () => {
      mockLogin.mockResolvedValue({ id: '1' });
      render(h(LoginScreen, null));
      fillForm();

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      // After success, router.replace('/') is called; inputs state doesn't matter
      // but loading should be false
      expect(getSubmitButton().disabled).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Success
  // -------------------------------------------------------------------------

  describe('success', () => {
    it('calls router.replace("/") on successful login', async () => {
      mockLogin.mockResolvedValue({ id: '1', email: 'user@example.com', nickname: 'Tester' });
      render(h(LoginScreen, null));
      fillForm();

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => expect(mockRouterReplace).toHaveBeenCalledWith('/'));
    });

    it('does not show server error on success', async () => {
      mockLogin.mockResolvedValue({ id: '1' });
      render(h(LoginScreen, null));
      fillForm();

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      expect(screen.queryByTestId('login-server-error')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 401 failure
  // -------------------------------------------------------------------------

  describe('401 failure (invalid credentials)', () => {
    it('shows "邮箱或密码错误，请重试" on 401 error', async () => {
      const err = new Error('邮箱或密码错误，请重试');
      err.status = 401;
      mockLogin.mockRejectedValue(err);

      render(h(LoginScreen, null));
      fillForm();

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByTestId('login-server-error').textContent).toBe('邮箱或密码错误，请重试');
      });
    });

    it('clears password field on 401 error', async () => {
      const err = new Error('邮箱或密码错误，请重试');
      err.status = 401;
      mockLogin.mockRejectedValue(err);

      render(h(LoginScreen, null));
      fillForm({ email: 'user@example.com', password: 'wrongpassword' });

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getPasswordInput().value).toBe('');
      });
    });

    it('preserves email field on 401 error', async () => {
      const err = new Error('邮箱或密码错误，请重试');
      err.status = 401;
      mockLogin.mockRejectedValue(err);

      render(h(LoginScreen, null));
      fillForm({ email: 'user@example.com', password: 'wrongpassword' });

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getEmailInput().value).toBe('user@example.com');
      });
    });

    it('does not call router.replace on 401 error', async () => {
      const err = new Error('邮箱或密码错误，请重试');
      err.status = 401;
      mockLogin.mockRejectedValue(err);

      render(h(LoginScreen, null));
      fillForm();

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByTestId('login-server-error')).toBeDefined();
      });

      expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    it('re-enables button and inputs after 401 error', async () => {
      const err = new Error('邮箱或密码错误，请重试');
      err.status = 401;
      mockLogin.mockRejectedValue(err);

      render(h(LoginScreen, null));
      fillForm();

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getSubmitButton().disabled).toBe(false);
        expect(getEmailInput().disabled).toBe(false);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Network / other failure
  // -------------------------------------------------------------------------

  describe('network / other failure', () => {
    it('shows error message from thrown error on network failure', async () => {
      const err = new Error('网络连接失败，请稍后重试');
      mockLogin.mockRejectedValue(err);

      render(h(LoginScreen, null));
      fillForm();

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByTestId('login-server-error').textContent).toBe('网络连接失败，请稍后重试');
      });
    });

    it('does not clear password on non-401 error', async () => {
      const err = new Error('网络连接失败，请稍后重试');
      mockLogin.mockRejectedValue(err);

      render(h(LoginScreen, null));
      fillForm({ email: 'user@example.com', password: 'mypassword' });

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByTestId('login-server-error')).toBeDefined();
      });

      expect(getPasswordInput().value).toBe('mypassword');
    });
  });

  // -------------------------------------------------------------------------
  // Navigation to register
  // -------------------------------------------------------------------------

  describe('navigation to register', () => {
    it('calls router.push("/register") when register link is clicked', () => {
      render(h(LoginScreen, null));
      fireEvent.click(getRegisterLink());
      expect(mockRouterPush).toHaveBeenCalledWith('/register');
    });

    it('clears form fields when register link is clicked', () => {
      render(h(LoginScreen, null));
      fillForm({ email: 'user@example.com', password: 'mypassword' });
      fireEvent.click(getRegisterLink());
      expect(getEmailInput().value).toBe('');
      expect(getPasswordInput().value).toBe('');
    });

    it('clears server error when register link is clicked', async () => {
      const err = new Error('网络连接失败，请稍后重试');
      mockLogin.mockRejectedValue(err);

      render(h(LoginScreen, null));
      fillForm();

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByTestId('login-server-error')).toBeDefined();
      });

      fireEvent.click(getRegisterLink());
      expect(screen.queryByTestId('login-server-error')).toBeNull();
    });
  });
});
