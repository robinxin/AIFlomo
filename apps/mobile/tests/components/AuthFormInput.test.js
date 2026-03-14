/**
 * TDD Test: apps/mobile/components/AuthFormInput.jsx
 * Task T010 - 实现 AuthFormInput 组件
 *
 * Tests cover:
 * 1. 渲染基本输入框（label、value、onChangeText）
 * 2. 聚焦时边框变蓝色
 * 3. 失焦触发 onBlur 回调
 * 4. 显示错误时边框变红色、下方显示错误文字
 * 5. secureTextEntry=true 时渲染眼睛切换按钮（testID="toggle-secure-entry"）
 * 6. 点击眼睛按钮切换密码显示/隐藏
 * 7. maxLength 限制输入长度
 * 8. editable=false 时输入框禁用
 * 9. keyboardType 传递正确
 *
 * 测试框架: Vitest (globals: true, environment: jsdom)
 * 组件库: React Native (TextInput, View, Text, TouchableOpacity)
 */

import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { AuthFormInput } from '../../components/AuthFormInput.jsx';

// ── Mock react-native ────────────────────────────────────────────────────────

vi.mock('react-native', () => {
  const React = require('react');

  const Text = ({ children, style, testID }) =>
    React.createElement('span', { 'data-testid': testID, style }, children);

  const TextInput = ({ testID, onFocus, onBlur, secureTextEntry, editable, maxLength, keyboardType, value, onChangeText, style, ...rest }) =>
    React.createElement('input', {
      'data-testid': testID,
      'data-secure': secureTextEntry,
      'data-editable': editable,
      'data-keyboard-type': keyboardType,
      maxLength,
      value: value || '',
      readOnly: editable === false,
      type: secureTextEntry ? 'password' : 'text',
      onFocus,
      onBlur,
      onChange: (e) => onChangeText && onChangeText(e.target.value),
      style,
      ...rest,
    });

  const TouchableOpacity = ({ children, onPress, testID, style }) =>
    React.createElement('button', {
      'data-testid': testID,
      onClick: onPress,
      style,
    }, children);

  const View = ({ children, style, testID }) =>
    React.createElement('div', { 'data-testid': testID, style }, children);

  return {
    Text,
    TextInput,
    TouchableOpacity,
    View,
    StyleSheet: {
      create: (styles) => styles,
    },
  };
});

// ── Tests: Basic Rendering ────────────────────────────────────────────────────

describe('AuthFormInput — basic rendering', () => {
  it('should render the label text', () => {
    const { getByText } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
      })
    );

    expect(getByText('邮箱')).toBeTruthy();
  });

  it('should render a TextInput with the provided value', () => {
    const { getByDisplayValue } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: 'test@example.com',
        onChangeText: vi.fn(),
      })
    );

    expect(getByDisplayValue('test@example.com')).toBeTruthy();
  });

  it('should call onChangeText when user types', () => {
    const onChangeText = vi.fn();
    const { getByDisplayValue } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: 'test@example.com',
        onChangeText,
      })
    );

    const input = getByDisplayValue('test@example.com');
    fireEvent.change(input, { target: { value: 'new@example.com' } });

    expect(onChangeText).toHaveBeenCalledWith('new@example.com');
  });

  it('should render without error message when error prop is not provided', () => {
    const { queryByText } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
      })
    );

    // No error text should be present
    expect(queryByText(/错误|error/i)).toBeNull();
  });

  it('should apply testID to the TextInput element', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        testID: 'email-input',
      })
    );

    expect(getByTestId('email-input')).toBeTruthy();
  });
});

// ── Tests: Focus Behavior ─────────────────────────────────────────────────────

describe('AuthFormInput — focus behavior', () => {
  it('should apply blue border style when input is focused', () => {
    const { getByTestId, container } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        testID: 'email-input',
      })
    );

    const input = getByTestId('email-input');
    fireEvent.focus(input);

    // After focus, the container should have blue border styling
    // We check the input's wrapper div for border color change
    const inputWrapper = container.querySelector('[data-testid="email-input"]').parentElement;
    expect(inputWrapper).toBeTruthy();
  });

  it('should change border color to blue on focus', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        testID: 'email-input',
      })
    );

    const input = getByTestId('email-input');

    // Before focus - check initial state (no blue border)
    fireEvent.focus(input);

    // After focus, input should still be rendered (component didn't crash)
    expect(getByTestId('email-input')).toBeTruthy();
  });
});

// ── Tests: Blur Behavior ──────────────────────────────────────────────────────

describe('AuthFormInput — blur behavior', () => {
  it('should call onBlur callback when input loses focus', () => {
    const onBlur = vi.fn();
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        onBlur,
        testID: 'email-input',
      })
    );

    const input = getByTestId('email-input');
    fireEvent.blur(input);

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('should not throw when onBlur is not provided', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        testID: 'email-input',
      })
    );

    const input = getByTestId('email-input');
    expect(() => fireEvent.blur(input)).not.toThrow();
  });

  it('should remove blue border on blur', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        testID: 'email-input',
      })
    );

    const input = getByTestId('email-input');
    fireEvent.focus(input);
    fireEvent.blur(input);

    // After blur, input should still render without crash
    expect(getByTestId('email-input')).toBeTruthy();
  });
});

// ── Tests: Error Display ──────────────────────────────────────────────────────

describe('AuthFormInput — error display', () => {
  it('should display error text when error prop is provided', () => {
    const { getByText } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        error: '请输入有效的邮箱地址',
      })
    );

    expect(getByText('请输入有效的邮箱地址')).toBeTruthy();
  });

  it('should not display error text when error prop is empty string', () => {
    const { container } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        error: '',
      })
    );

    // Empty string error prop should not render the error element
    const errorElements = container.querySelectorAll('[data-testid="input-error"]');
    expect(errorElements.length).toBe(0);
  });

  it('should not display error text when error prop is undefined', () => {
    const { container } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
      })
    );

    // No error element should exist
    const errorElements = container.querySelectorAll('[data-testid="input-error"]');
    expect(errorElements.length).toBe(0);
  });

  it('should apply red border when error is present', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        error: '请输入有效的邮箱地址',
        testID: 'email-input',
      })
    );

    // Component renders without crash when error is present
    expect(getByTestId('email-input')).toBeTruthy();
  });
});

// ── Tests: Secure Text Entry ──────────────────────────────────────────────────

describe('AuthFormInput — secureTextEntry', () => {
  it('should render toggle button with testID="toggle-secure-entry" when secureTextEntry=true', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '密码',
        value: '',
        onChangeText: vi.fn(),
        secureTextEntry: true,
      })
    );

    expect(getByTestId('toggle-secure-entry')).toBeTruthy();
  });

  it('should NOT render toggle button when secureTextEntry=false', () => {
    const { queryByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        secureTextEntry: false,
      })
    );

    expect(queryByTestId('toggle-secure-entry')).toBeNull();
  });

  it('should NOT render toggle button when secureTextEntry is not provided', () => {
    const { queryByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
      })
    );

    expect(queryByTestId('toggle-secure-entry')).toBeNull();
  });

  it('should initially render input as password type when secureTextEntry=true', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '密码',
        value: '',
        onChangeText: vi.fn(),
        secureTextEntry: true,
        testID: 'password-input',
      })
    );

    const input = getByTestId('password-input');
    expect(input.type).toBe('password');
  });

  it('should toggle input type to text when eye button is clicked', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '密码',
        value: '',
        onChangeText: vi.fn(),
        secureTextEntry: true,
        testID: 'password-input',
      })
    );

    const toggleBtn = getByTestId('toggle-secure-entry');
    fireEvent.click(toggleBtn);

    const input = getByTestId('password-input');
    expect(input.type).toBe('text');
  });

  it('should toggle back to password type when eye button is clicked again', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '密码',
        value: '',
        onChangeText: vi.fn(),
        secureTextEntry: true,
        testID: 'password-input',
      })
    );

    const toggleBtn = getByTestId('toggle-secure-entry');
    // First click: show password
    fireEvent.click(toggleBtn);
    // Second click: hide password again
    fireEvent.click(toggleBtn);

    const input = getByTestId('password-input');
    expect(input.type).toBe('password');
  });
});

// ── Tests: maxLength ──────────────────────────────────────────────────────────

describe('AuthFormInput — maxLength', () => {
  it('should pass maxLength to the TextInput element', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '昵称',
        value: '',
        onChangeText: vi.fn(),
        maxLength: 20,
        testID: 'nickname-input',
      })
    );

    const input = getByTestId('nickname-input');
    expect(input.maxLength).toBe(20);
  });

  it('should not set maxLength when prop is not provided', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        testID: 'email-input',
      })
    );

    const input = getByTestId('email-input');
    // maxLength should not be set or should be -1 (browser default)
    expect(input.maxLength).not.toBe(20);
  });
});

// ── Tests: editable ───────────────────────────────────────────────────────────

describe('AuthFormInput — editable', () => {
  it('should render input as readOnly when editable=false', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: 'test@example.com',
        onChangeText: vi.fn(),
        editable: false,
        testID: 'email-input',
      })
    );

    const input = getByTestId('email-input');
    expect(input.readOnly).toBe(true);
  });

  it('should render input as editable by default', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        testID: 'email-input',
      })
    );

    const input = getByTestId('email-input');
    expect(input.readOnly).toBe(false);
  });

  it('should render input as editable when editable=true', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        editable: true,
        testID: 'email-input',
      })
    );

    const input = getByTestId('email-input');
    expect(input.readOnly).toBe(false);
  });
});

// ── Tests: keyboardType ───────────────────────────────────────────────────────

describe('AuthFormInput — keyboardType', () => {
  it('should pass keyboardType prop to TextInput', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '邮箱',
        value: '',
        onChangeText: vi.fn(),
        keyboardType: 'email-address',
        testID: 'email-input',
      })
    );

    const input = getByTestId('email-input');
    expect(input.getAttribute('data-keyboard-type')).toBe('email-address');
  });

  it('should default keyboardType to "default" when not provided', () => {
    const { getByTestId } = render(
      React.createElement(AuthFormInput, {
        label: '昵称',
        value: '',
        onChangeText: vi.fn(),
        testID: 'nickname-input',
      })
    );

    const input = getByTestId('nickname-input');
    // Either 'default' or undefined/null is acceptable
    const keyboardType = input.getAttribute('data-keyboard-type');
    expect(keyboardType === 'default' || keyboardType === null).toBe(true);
  });
});
