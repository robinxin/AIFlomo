import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { PrivacyCheckbox } from '../../components/PrivacyCheckbox.jsx';

describe('PrivacyCheckbox', () => {
  const defaultProps = {
    checked: false,
    onChange: vi.fn(),
  };

  test('renders checkbox in unchecked state', () => {
    render(React.createElement(PrivacyCheckbox, defaultProps));
    expect(screen.queryByTestId('checkbox-checked-icon')).toBeNull();
  });

  test('renders checked icon when checked is true', () => {
    render(React.createElement(PrivacyCheckbox, { ...defaultProps, checked: true }));
    expect(screen.getByTestId('checkbox-checked-icon')).toBeTruthy();
  });

  test('calls onChange with true when unchecked checkbox is clicked', () => {
    const onChange = vi.fn();
    render(React.createElement(PrivacyCheckbox, { checked: false, onChange }));
    // Click on the privacy policy text to trigger toggle
    fireEvent.click(screen.getByText('我已阅读并同意隐私协议'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  test('calls onChange with false when checked checkbox is clicked', () => {
    const onChange = vi.fn();
    render(React.createElement(PrivacyCheckbox, { checked: true, onChange }));
    fireEvent.click(screen.getByTestId('checkbox-checked-icon'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  test('displays error message when error is true', () => {
    render(React.createElement(PrivacyCheckbox, { ...defaultProps, error: true }));
    expect(screen.getByText('请阅读并同意隐私协议')).toBeTruthy();
  });

  test('does not display error message when error is false', () => {
    render(React.createElement(PrivacyCheckbox, { ...defaultProps, error: false }));
    expect(screen.queryByText('请阅读并同意隐私协议')).toBeNull();
  });

  test('does not display error message when error is not provided', () => {
    render(React.createElement(PrivacyCheckbox, defaultProps));
    expect(screen.queryByText('请阅读并同意隐私协议')).toBeNull();
  });

  test('applies testID prop', () => {
    render(React.createElement(PrivacyCheckbox, { ...defaultProps, testID: 'privacy-checkbox' }));
    expect(screen.getByTestId('privacy-checkbox')).toBeTruthy();
  });

  test('renders privacy policy text', () => {
    render(React.createElement(PrivacyCheckbox, defaultProps));
    expect(screen.getByText('我已阅读并同意隐私协议')).toBeTruthy();
  });
});
