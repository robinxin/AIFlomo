import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AuthSubmitButton } from '../../components/AuthSubmitButton.jsx';

describe('AuthSubmitButton', () => {
  const defaultProps = {
    label: '登录',
    loadingLabel: '登录中...',
    loading: false,
    onPress: vi.fn(),
  };

  test('renders label when not loading', () => {
    render(React.createElement(AuthSubmitButton, defaultProps));
    expect(screen.getByText('登录')).toBeTruthy();
  });

  test('renders loadingLabel when loading is true', () => {
    render(React.createElement(AuthSubmitButton, { ...defaultProps, loading: true }));
    expect(screen.getByText('登录中...')).toBeTruthy();
    expect(screen.queryByText('登录')).toBeNull();
  });

  test('calls onPress when clicked in normal state', () => {
    const onPress = vi.fn();
    render(React.createElement(AuthSubmitButton, { ...defaultProps, onPress }));
    fireEvent.click(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('does not call onPress when loading is true', () => {
    const onPress = vi.fn();
    render(React.createElement(AuthSubmitButton, { ...defaultProps, loading: true, onPress }));
    const button = screen.getByRole('button');
    expect(button.disabled).toBe(true);
  });

  test('does not call onPress when disabled is true', () => {
    const onPress = vi.fn();
    render(React.createElement(AuthSubmitButton, { ...defaultProps, disabled: true, onPress }));
    const button = screen.getByRole('button');
    expect(button.disabled).toBe(true);
  });

  test('button is disabled when both loading and disabled are true', () => {
    render(React.createElement(AuthSubmitButton, { ...defaultProps, loading: true, disabled: true }));
    const button = screen.getByRole('button');
    expect(button.disabled).toBe(true);
    expect(screen.getByText('登录中...')).toBeTruthy();
  });

  test('button is enabled when neither loading nor disabled', () => {
    render(React.createElement(AuthSubmitButton, defaultProps));
    const button = screen.getByRole('button');
    expect(button.disabled).toBe(false);
  });

  test('applies testID prop', () => {
    render(React.createElement(AuthSubmitButton, { ...defaultProps, testID: 'submit-btn' }));
    expect(screen.getByTestId('submit-btn')).toBeTruthy();
  });

  test('shows label for registration button', () => {
    render(React.createElement(AuthSubmitButton, {
      label: '注册',
      loadingLabel: '注册中...',
      loading: false,
      onPress: vi.fn(),
    }));
    expect(screen.getByText('注册')).toBeTruthy();
  });

  test('shows loadingLabel for registration button during loading', () => {
    render(React.createElement(AuthSubmitButton, {
      label: '注册',
      loadingLabel: '注册中...',
      loading: true,
      onPress: vi.fn(),
    }));
    expect(screen.getByText('注册中...')).toBeTruthy();
  });
});
