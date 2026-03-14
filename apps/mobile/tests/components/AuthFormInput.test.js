import { describe, it, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { AuthFormInput } from '../../components/AuthFormInput.jsx';

describe('AuthFormInput', () => {
  const defaultProps = {
    label: '邮箱',
    value: '',
    onChangeText: vi.fn(),
  };

  test('renders with label text', () => {
    render(React.createElement(AuthFormInput, defaultProps));
    expect(screen.getByText('邮箱')).toBeTruthy();
  });

  test('renders input with provided value', () => {
    render(React.createElement(AuthFormInput, { ...defaultProps, value: 'test@example.com' }));
    const input = screen.getByDisplayValue('test@example.com');
    expect(input).toBeTruthy();
  });

  test('calls onChangeText when input changes', () => {
    const onChangeText = vi.fn();
    render(React.createElement(AuthFormInput, { ...defaultProps, onChangeText }));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'newvalue' } });
    expect(onChangeText).toHaveBeenCalled();
  });

  test('calls onBlur when input loses focus', () => {
    const onBlur = vi.fn();
    render(React.createElement(AuthFormInput, { ...defaultProps, onBlur }));
    const input = screen.getByRole('textbox');
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalled();
  });

  test('displays error message when error prop is provided', () => {
    render(React.createElement(AuthFormInput, { ...defaultProps, error: '请输入有效的邮箱地址' }));
    expect(screen.getByText('请输入有效的邮箱地址')).toBeTruthy();
  });

  test('does not display error message when error is empty', () => {
    render(React.createElement(AuthFormInput, { ...defaultProps, error: '' }));
    expect(screen.queryByText('请输入有效的邮箱地址')).toBeNull();
  });

  test('renders toggle button when secureTextEntry is true', () => {
    render(React.createElement(AuthFormInput, { ...defaultProps, secureTextEntry: true }));
    const toggleBtn = screen.getByTestId('toggle-secure-entry');
    expect(toggleBtn).toBeTruthy();
  });

  test('does not render toggle button when secureTextEntry is false', () => {
    render(React.createElement(AuthFormInput, { ...defaultProps, secureTextEntry: false }));
    expect(screen.queryByTestId('toggle-secure-entry')).toBeNull();
  });

  test('does not render toggle button when secureTextEntry is not provided', () => {
    render(React.createElement(AuthFormInput, defaultProps));
    expect(screen.queryByTestId('toggle-secure-entry')).toBeNull();
  });

  test('clicking toggle button switches input type from password to text', () => {
    render(React.createElement(AuthFormInput, { ...defaultProps, secureTextEntry: true }));
    const toggleBtn = screen.getByTestId('toggle-secure-entry');
    const input = screen.getByLabelText('邮箱') || document.querySelector('input');
    // Initially should be password type
    expect(input.type).toBe('password');
    fireEvent.click(toggleBtn);
    // After toggle should be text type
    expect(input.type).toBe('text');
  });

  test('clicking toggle button twice returns to password type', () => {
    render(React.createElement(AuthFormInput, { ...defaultProps, secureTextEntry: true }));
    const toggleBtn = screen.getByTestId('toggle-secure-entry');
    const input = document.querySelector('input');
    fireEvent.click(toggleBtn);
    expect(input.type).toBe('text');
    fireEvent.click(toggleBtn);
    expect(input.type).toBe('password');
  });

  test('respects testID prop', () => {
    render(React.createElement(AuthFormInput, { ...defaultProps, testID: 'email-input' }));
    expect(screen.getByTestId('email-input')).toBeTruthy();
  });

  test('disables input when editable is false', () => {
    render(React.createElement(AuthFormInput, { ...defaultProps, editable: false }));
    const input = document.querySelector('input');
    expect(input.disabled).toBe(true);
  });

  test('limits input length with maxLength', () => {
    render(React.createElement(AuthFormInput, { ...defaultProps, maxLength: 10 }));
    const input = document.querySelector('input');
    expect(input.maxLength).toBe(10);
  });
});
