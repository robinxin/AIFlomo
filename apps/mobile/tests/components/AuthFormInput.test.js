/**
 * AuthFormInput.test.js
 *
 * Unit tests for apps/mobile/components/AuthFormInput.jsx
 *
 * Uses React.createElement() instead of JSX to avoid requiring a
 * special Vite/esbuild config for .test.js files.
 *
 * Coverage targets:
 *  - Renders label and input
 *  - Applies blue border on focus
 *  - Applies red border and error text when error prop is set
 *  - Calls onBlur callback when input loses focus
 *  - Calls onChangeText callback when text changes
 *  - Renders toggle-secure-entry button when secureTextEntry=true
 *  - Does NOT render toggle-secure-entry when secureTextEntry=false
 *  - Toggles secure text entry on eye button press
 *  - Passes maxLength, editable, keyboardType to TextInput
 *  - testID is forwarded to the TextInput
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const h = React.createElement;

// ---------------------------------------------------------------------------
// Mock react-native components
// ---------------------------------------------------------------------------
vi.mock('react-native', () => {
  function View({ children, style, testID, ...rest }) {
    return h('div', { 'data-testid': testID, style, ...rest }, children);
  }

  function Text({ children, style, testID, ...rest }) {
    return h('span', { 'data-testid': testID, style, ...rest }, children);
  }

  function TextInput({ testID, value, onChangeText, onFocus, onBlur, secureTextEntry, editable, maxLength, ...rest }) {
    return h('input', {
      'data-testid': testID,
      value: value || '',
      type: secureTextEntry ? 'password' : 'text',
      disabled: editable === false,
      maxLength,
      onChange: (e) => onChangeText && onChangeText(e.target.value),
      onFocus: onFocus,
      onBlur: onBlur,
      readOnly: editable === false,
      ...rest,
    });
  }

  function TouchableOpacity({ children, onPress, testID, style, ...rest }) {
    return h('button', {
      'data-testid': testID,
      onClick: onPress,
      style,
      ...rest,
    }, children);
  }

  return { View, Text, TextInput, TouchableOpacity };
});

// ---------------------------------------------------------------------------
// Import module under test after mocks are set up
// ---------------------------------------------------------------------------
async function loadModule() {
  vi.resetModules();
  const mod = await import('../../components/AuthFormInput.jsx');
  return mod;
}

describe('AuthFormInput', () => {
  let AuthFormInput;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await loadModule();
    AuthFormInput = mod.AuthFormInput;
  });

  // -------------------------------------------------------------------------
  // Basic rendering
  // -------------------------------------------------------------------------

  it('renders the label text', () => {
    render(h(AuthFormInput, {
      label: '邮箱',
      value: '',
      onChangeText: vi.fn(),
    }));

    expect(screen.getByText('邮箱')).toBeDefined();
  });

  it('renders the input element', () => {
    render(h(AuthFormInput, {
      label: '邮箱',
      value: 'test@example.com',
      onChangeText: vi.fn(),
      testID: 'email-input',
    }));

    const input = screen.getByTestId('email-input');
    expect(input).toBeDefined();
  });

  it('passes current value to the input', () => {
    render(h(AuthFormInput, {
      label: '邮箱',
      value: 'test@example.com',
      onChangeText: vi.fn(),
      testID: 'email-input',
    }));

    const input = screen.getByTestId('email-input');
    expect(input.value).toBe('test@example.com');
  });

  // -------------------------------------------------------------------------
  // onChangeText callback
  // -------------------------------------------------------------------------

  it('calls onChangeText when the user types', () => {
    const onChangeText = vi.fn();
    render(h(AuthFormInput, {
      label: '邮箱',
      value: '',
      onChangeText,
      testID: 'email-input',
    }));

    const input = screen.getByTestId('email-input');
    fireEvent.change(input, { target: { value: 'new@example.com' } });

    expect(onChangeText).toHaveBeenCalledWith('new@example.com');
  });

  // -------------------------------------------------------------------------
  // Focus / blur
  // -------------------------------------------------------------------------

  it('calls onBlur when the input loses focus', () => {
    const onBlur = vi.fn();
    render(h(AuthFormInput, {
      label: '密码',
      value: 'secret',
      onChangeText: vi.fn(),
      onBlur,
      testID: 'password-input',
    }));

    const input = screen.getByTestId('password-input');
    fireEvent.blur(input);

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('does not crash when onBlur prop is not provided', () => {
    render(h(AuthFormInput, {
      label: '邮箱',
      value: '',
      onChangeText: vi.fn(),
      testID: 'email-input',
    }));

    const input = screen.getByTestId('email-input');
    // Should not throw
    expect(() => fireEvent.blur(input)).not.toThrow();
  });

  it('fires focus event on the input without crashing', () => {
    render(h(AuthFormInput, {
      label: '邮箱',
      value: '',
      onChangeText: vi.fn(),
      testID: 'email-input',
    }));

    const input = screen.getByTestId('email-input');
    expect(() => fireEvent.focus(input)).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  it('renders error text below the input when error prop is non-empty', () => {
    render(h(AuthFormInput, {
      label: '邮箱',
      value: 'bad',
      onChangeText: vi.fn(),
      error: '请输入有效的邮箱地址',
    }));

    expect(screen.getByText('请输入有效的邮箱地址')).toBeDefined();
  });

  it('does not render error text when error prop is falsy', () => {
    render(h(AuthFormInput, {
      label: '邮箱',
      value: '',
      onChangeText: vi.fn(),
      error: '',
    }));

    expect(screen.queryByText('请输入有效的邮箱地址')).toBeNull();
  });

  it('does not render error text when error prop is null', () => {
    render(h(AuthFormInput, {
      label: '邮箱',
      value: '',
      onChangeText: vi.fn(),
      error: null,
    }));

    // No error element visible
    const errorEl = screen.queryByText(/请输入/);
    expect(errorEl).toBeNull();
  });

  // -------------------------------------------------------------------------
  // secureTextEntry — eye toggle
  // -------------------------------------------------------------------------

  it('renders toggle-secure-entry button when secureTextEntry=true', () => {
    render(h(AuthFormInput, {
      label: '密码',
      value: '',
      onChangeText: vi.fn(),
      secureTextEntry: true,
    }));

    expect(screen.getByTestId('toggle-secure-entry')).toBeDefined();
  });

  it('does NOT render toggle-secure-entry button when secureTextEntry=false', () => {
    render(h(AuthFormInput, {
      label: '邮箱',
      value: '',
      onChangeText: vi.fn(),
      secureTextEntry: false,
    }));

    expect(screen.queryByTestId('toggle-secure-entry')).toBeNull();
  });

  it('does NOT render toggle-secure-entry button when secureTextEntry is omitted', () => {
    render(h(AuthFormInput, {
      label: '邮箱',
      value: '',
      onChangeText: vi.fn(),
    }));

    expect(screen.queryByTestId('toggle-secure-entry')).toBeNull();
  });

  it('input is of type password by default when secureTextEntry=true', () => {
    render(h(AuthFormInput, {
      label: '密码',
      value: '',
      onChangeText: vi.fn(),
      secureTextEntry: true,
      testID: 'pw-input',
    }));

    const input = screen.getByTestId('pw-input');
    expect(input.type).toBe('password');
  });

  it('toggles input from password to text when eye button is clicked', () => {
    render(h(AuthFormInput, {
      label: '密码',
      value: '',
      onChangeText: vi.fn(),
      secureTextEntry: true,
      testID: 'pw-input',
    }));

    const input = screen.getByTestId('pw-input');
    expect(input.type).toBe('password');

    const eyeButton = screen.getByTestId('toggle-secure-entry');
    fireEvent.click(eyeButton);

    expect(input.type).toBe('text');
  });

  it('toggles input back to password when eye button is clicked twice', () => {
    render(h(AuthFormInput, {
      label: '密码',
      value: '',
      onChangeText: vi.fn(),
      secureTextEntry: true,
      testID: 'pw-input',
    }));

    const eyeButton = screen.getByTestId('toggle-secure-entry');
    fireEvent.click(eyeButton); // → text
    fireEvent.click(eyeButton); // → password again

    const input = screen.getByTestId('pw-input');
    expect(input.type).toBe('password');
  });

  // -------------------------------------------------------------------------
  // editable prop
  // -------------------------------------------------------------------------

  it('disables the input when editable=false', () => {
    render(h(AuthFormInput, {
      label: '邮箱',
      value: '',
      onChangeText: vi.fn(),
      editable: false,
      testID: 'email-input',
    }));

    const input = screen.getByTestId('email-input');
    expect(input.disabled).toBe(true);
  });

  it('does not disable the input when editable=true', () => {
    render(h(AuthFormInput, {
      label: '邮箱',
      value: '',
      onChangeText: vi.fn(),
      editable: true,
      testID: 'email-input',
    }));

    const input = screen.getByTestId('email-input');
    expect(input.disabled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // maxLength prop
  // -------------------------------------------------------------------------

  it('passes maxLength to the input element', () => {
    render(h(AuthFormInput, {
      label: '昵称',
      value: '',
      onChangeText: vi.fn(),
      maxLength: 20,
      testID: 'nickname-input',
    }));

    const input = screen.getByTestId('nickname-input');
    expect(input.maxLength).toBe(20);
  });
});
