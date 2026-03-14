/**
 * TDD Test: apps/mobile/components/AuthSubmitButton.jsx
 * Task 12 - 实现 AuthSubmitButton 组件
 *
 * Tests cover:
 * 1. 渲染基本按钮（显示 label）
 * 2. 点击时调用 onPress
 * 3. loading=true 时显示 loadingLabel
 * 4. loading=true 时按钮禁用
 * 5. loading=true 时点击不触发 onPress
 * 6. disabled=true 时按钮禁用
 * 7. disabled=true 时点击不触发 onPress
 * 8. loading=true && disabled=true 时按钮禁用（独立叠加）
 * 9. 应用 testID
 * 10. loading=false && disabled=false 时按钮可点击
 *
 * 测试框架: Vitest (globals: true, environment: jsdom)
 * 组件库: React Native (TouchableOpacity, Text)
 */

import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { AuthSubmitButton } from '../../components/AuthSubmitButton.jsx';

// ── Mock react-native ────────────────────────────────────────────────────────

vi.mock('react-native', () => {
  const React = require('react');

  const Text = ({ children, style, testID }) =>
    React.createElement('span', { 'data-testid': testID, style }, children);

  const TouchableOpacity = ({ children, onPress, testID, style, disabled }) =>
    React.createElement(
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

describe('AuthSubmitButton — basic rendering', () => {
  it('should render the button with the label text', () => {
    const { getByText } = render(
      React.createElement(AuthSubmitButton, {
        label: '注册',
        loadingLabel: '注册中...',
        loading: false,
        onPress: vi.fn(),
      })
    );

    expect(getByText('注册')).toBeTruthy();
  });

  it('should render the button with testID when provided', () => {
    const { getByTestId } = render(
      React.createElement(AuthSubmitButton, {
        label: '注册',
        loadingLabel: '注册中...',
        loading: false,
        onPress: vi.fn(),
        testID: 'submit-button',
      })
    );

    expect(getByTestId('submit-button')).toBeTruthy();
  });
});

// ── Tests: onPress behavior ───────────────────────────────────────────────────

describe('AuthSubmitButton — onPress behavior', () => {
  it('should call onPress when button is clicked and not disabled or loading', () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      React.createElement(AuthSubmitButton, {
        label: '注册',
        loadingLabel: '注册中...',
        loading: false,
        onPress,
        testID: 'submit-button',
      })
    );

    fireEvent.click(getByTestId('submit-button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('should be clickable when loading=false and disabled=false', () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      React.createElement(AuthSubmitButton, {
        label: '登录',
        loadingLabel: '登录中...',
        loading: false,
        disabled: false,
        onPress,
        testID: 'submit-button',
      })
    );

    fireEvent.click(getByTestId('submit-button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});

// ── Tests: loading state ──────────────────────────────────────────────────────

describe('AuthSubmitButton — loading state', () => {
  it('should display loadingLabel when loading=true', () => {
    const { getByText } = render(
      React.createElement(AuthSubmitButton, {
        label: '注册',
        loadingLabel: '注册中...',
        loading: true,
        onPress: vi.fn(),
      })
    );

    expect(getByText('注册中...')).toBeTruthy();
  });

  it('should NOT display label when loading=true', () => {
    const { queryByText } = render(
      React.createElement(AuthSubmitButton, {
        label: '注册',
        loadingLabel: '注册中...',
        loading: true,
        onPress: vi.fn(),
      })
    );

    expect(queryByText('注册')).toBeNull();
  });

  it('should disable the button when loading=true', () => {
    const { getByTestId } = render(
      React.createElement(AuthSubmitButton, {
        label: '注册',
        loadingLabel: '注册中...',
        loading: true,
        onPress: vi.fn(),
        testID: 'submit-button',
      })
    );

    expect(getByTestId('submit-button').disabled).toBe(true);
  });

  it('should NOT call onPress when loading=true and button is clicked', () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      React.createElement(AuthSubmitButton, {
        label: '注册',
        loadingLabel: '注册中...',
        loading: true,
        onPress,
        testID: 'submit-button',
      })
    );

    fireEvent.click(getByTestId('submit-button'));

    expect(onPress).not.toHaveBeenCalled();
  });
});

// ── Tests: disabled state ─────────────────────────────────────────────────────

describe('AuthSubmitButton — disabled state', () => {
  it('should disable the button when disabled=true', () => {
    const { getByTestId } = render(
      React.createElement(AuthSubmitButton, {
        label: '注册',
        loadingLabel: '注册中...',
        loading: false,
        disabled: true,
        onPress: vi.fn(),
        testID: 'submit-button',
      })
    );

    expect(getByTestId('submit-button').disabled).toBe(true);
  });

  it('should NOT call onPress when disabled=true and button is clicked', () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      React.createElement(AuthSubmitButton, {
        label: '注册',
        loadingLabel: '注册中...',
        loading: false,
        disabled: true,
        onPress,
        testID: 'submit-button',
      })
    );

    fireEvent.click(getByTestId('submit-button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('should still show label (not loadingLabel) when disabled=true and loading=false', () => {
    const { getByText } = render(
      React.createElement(AuthSubmitButton, {
        label: '注册',
        loadingLabel: '注册中...',
        loading: false,
        disabled: true,
        onPress: vi.fn(),
      })
    );

    expect(getByText('注册')).toBeTruthy();
  });
});

// ── Tests: loading and disabled combined ──────────────────────────────────────

describe('AuthSubmitButton — loading and disabled combined', () => {
  it('should disable the button when both loading=true and disabled=true', () => {
    const { getByTestId } = render(
      React.createElement(AuthSubmitButton, {
        label: '注册',
        loadingLabel: '注册中...',
        loading: true,
        disabled: true,
        onPress: vi.fn(),
        testID: 'submit-button',
      })
    );

    expect(getByTestId('submit-button').disabled).toBe(true);
  });

  it('should display loadingLabel when both loading=true and disabled=true', () => {
    const { getByText } = render(
      React.createElement(AuthSubmitButton, {
        label: '注册',
        loadingLabel: '注册中...',
        loading: true,
        disabled: true,
        onPress: vi.fn(),
      })
    );

    expect(getByText('注册中...')).toBeTruthy();
  });

  it('should NOT call onPress when both loading=true and disabled=true', () => {
    const onPress = vi.fn();
    const { getByTestId } = render(
      React.createElement(AuthSubmitButton, {
        label: '注册',
        loadingLabel: '注册中...',
        loading: true,
        disabled: true,
        onPress,
        testID: 'submit-button',
      })
    );

    fireEvent.click(getByTestId('submit-button'));

    expect(onPress).not.toHaveBeenCalled();
  });
});

// ── Tests: testID propagation ─────────────────────────────────────────────────

describe('AuthSubmitButton — testID', () => {
  it('should apply testID to the button element', () => {
    const { getByTestId } = render(
      React.createElement(AuthSubmitButton, {
        label: '登录',
        loadingLabel: '登录中...',
        loading: false,
        onPress: vi.fn(),
        testID: 'login-submit-button',
      })
    );

    expect(getByTestId('login-submit-button')).toBeTruthy();
  });

  it('should render without testID when prop is not provided', () => {
    const { container } = render(
      React.createElement(AuthSubmitButton, {
        label: '登录',
        loadingLabel: '登录中...',
        loading: false,
        onPress: vi.fn(),
      })
    );

    expect(container.firstChild).toBeTruthy();
  });
});
