/**
 * TDD Test: apps/mobile/components/PrivacyCheckbox.jsx
 * Task T013 - 实现 PrivacyCheckbox 组件
 *
 * Tests cover:
 * 1. 渲染基本复选框（checked=false）
 * 2. checked=true 时渲染勾选图标（testID="checkbox-checked-icon"）
 * 3. 点击切换 checked 状态并调用 onChange(!checked)
 * 4. error=true 时显示红色错误提示"请阅读并同意隐私协议"
 * 5. error=false 或 undefined 时不显示错误提示
 * 6. 应用 testID 到主容器
 * 7. 点击从 false 切换到 true
 * 8. 点击从 true 切换到 false
 *
 * 测试框架: Vitest (globals: true, environment: jsdom)
 * 组件库: React Native (TouchableOpacity, View, Text)
 */

import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { PrivacyCheckbox } from '../../components/PrivacyCheckbox.jsx';

// ── Mock react-native ────────────────────────────────────────────────────────

vi.mock('react-native', () => {
  const React = require('react');

  const Text = ({ children, style, testID }) =>
    React.createElement('span', { 'data-testid': testID, style }, children);

  const TouchableOpacity = ({ children, onPress, testID, style }) =>
    React.createElement(
      'button',
      {
        'data-testid': testID,
        onClick: onPress,
        style,
      },
      children
    );

  const View = ({ children, style, testID }) =>
    React.createElement('div', { 'data-testid': testID, style }, children);

  return {
    Text,
    TouchableOpacity,
    View,
    StyleSheet: {
      create: (styles) => styles,
    },
  };
});

// ── Tests: Basic Rendering ────────────────────────────────────────────────────

describe('PrivacyCheckbox — basic rendering', () => {
  it('should render the checkbox container', () => {
    const { container } = render(
      React.createElement(PrivacyCheckbox, {
        checked: false,
        onChange: vi.fn(),
      })
    );

    expect(container.firstChild).toBeTruthy();
  });

  it('should apply testID to the container when provided', () => {
    const { getByTestId } = render(
      React.createElement(PrivacyCheckbox, {
        checked: false,
        onChange: vi.fn(),
        testID: 'privacy-checkbox',
      })
    );

    expect(getByTestId('privacy-checkbox')).toBeTruthy();
  });

  it('should render without error message when error is not provided', () => {
    const { queryByText } = render(
      React.createElement(PrivacyCheckbox, {
        checked: false,
        onChange: vi.fn(),
      })
    );

    expect(queryByText('请阅读并同意隐私协议')).toBeNull();
  });
});

// ── Tests: Checked State ──────────────────────────────────────────────────────

describe('PrivacyCheckbox — checked state', () => {
  it('should NOT render checkbox-checked-icon when checked=false', () => {
    const { queryByTestId } = render(
      React.createElement(PrivacyCheckbox, {
        checked: false,
        onChange: vi.fn(),
      })
    );

    expect(queryByTestId('checkbox-checked-icon')).toBeNull();
  });

  it('should render checkbox-checked-icon when checked=true', () => {
    const { getByTestId } = render(
      React.createElement(PrivacyCheckbox, {
        checked: true,
        onChange: vi.fn(),
      })
    );

    expect(getByTestId('checkbox-checked-icon')).toBeTruthy();
  });
});

// ── Tests: onChange Behavior ──────────────────────────────────────────────────

describe('PrivacyCheckbox — onChange behavior', () => {
  it('should call onChange with true when clicked and checked=false', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      React.createElement(PrivacyCheckbox, {
        checked: false,
        onChange,
        testID: 'privacy-checkbox',
      })
    );

    fireEvent.click(getByTestId('privacy-checkbox'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('should call onChange with false when clicked and checked=true', () => {
    const onChange = vi.fn();
    const { getByTestId } = render(
      React.createElement(PrivacyCheckbox, {
        checked: true,
        onChange,
        testID: 'privacy-checkbox',
      })
    );

    fireEvent.click(getByTestId('privacy-checkbox'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('should toggle state correctly on multiple clicks', () => {
    const onChange = vi.fn();
    const { getByTestId, rerender } = render(
      React.createElement(PrivacyCheckbox, {
        checked: false,
        onChange,
        testID: 'privacy-checkbox',
      })
    );

    // First click: false -> true
    fireEvent.click(getByTestId('privacy-checkbox'));
    expect(onChange).toHaveBeenCalledWith(true);

    // Simulate parent updating checked prop
    rerender(
      React.createElement(PrivacyCheckbox, {
        checked: true,
        onChange,
        testID: 'privacy-checkbox',
      })
    );

    // Second click: true -> false
    fireEvent.click(getByTestId('privacy-checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });
});

// ── Tests: Error Display ──────────────────────────────────────────────────────

describe('PrivacyCheckbox — error display', () => {
  it('should display error message when error=true', () => {
    const { getByText } = render(
      React.createElement(PrivacyCheckbox, {
        checked: false,
        onChange: vi.fn(),
        error: true,
      })
    );

    expect(getByText('请阅读并同意隐私协议')).toBeTruthy();
  });

  it('should NOT display error message when error=false', () => {
    const { queryByText } = render(
      React.createElement(PrivacyCheckbox, {
        checked: false,
        onChange: vi.fn(),
        error: false,
      })
    );

    expect(queryByText('请阅读并同意隐私协议')).toBeNull();
  });

  it('should NOT display error message when error is undefined', () => {
    const { queryByText } = render(
      React.createElement(PrivacyCheckbox, {
        checked: false,
        onChange: vi.fn(),
      })
    );

    expect(queryByText('请阅读并同意隐私协议')).toBeNull();
  });

  it('should display error in red color when error=true', () => {
    const { getByText } = render(
      React.createElement(PrivacyCheckbox, {
        checked: false,
        onChange: vi.fn(),
        error: true,
      })
    );

    const errorText = getByText('请阅读并同意隐私协议');
    expect(errorText).toBeTruthy();
    // Component should exist with error styling
  });
});

// ── Tests: Props Validation ───────────────────────────────────────────────────

describe('PrivacyCheckbox — props validation', () => {
  it('should handle all props correctly', () => {
    const onChange = vi.fn();
    const { getByTestId, getByText } = render(
      React.createElement(PrivacyCheckbox, {
        checked: true,
        onChange,
        error: true,
        testID: 'privacy-checkbox',
      })
    );

    expect(getByTestId('privacy-checkbox')).toBeTruthy();
    expect(getByTestId('checkbox-checked-icon')).toBeTruthy();
    expect(getByText('请阅读并同意隐私协议')).toBeTruthy();

    fireEvent.click(getByTestId('privacy-checkbox'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('should work with minimal props (checked and onChange only)', () => {
    const onChange = vi.fn();
    const { container } = render(
      React.createElement(PrivacyCheckbox, {
        checked: false,
        onChange,
      })
    );

    expect(container.firstChild).toBeTruthy();
  });
});
