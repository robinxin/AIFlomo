/**
 * PrivacyCheckbox.test.js
 *
 * Unit tests for apps/mobile/components/PrivacyCheckbox.jsx
 *
 * Uses React.createElement() instead of JSX to avoid requiring a
 * special Vite/esbuild config for .test.js files.
 *
 * Coverage targets:
 *  - Renders without crashing
 *  - Renders checkbox-checked-icon when checked=true
 *  - Does NOT render checkbox-checked-icon when checked=false
 *  - Calls onChange(!checked) when checkbox area is pressed
 *  - Calls onChange(true) when unchecked and pressed
 *  - Calls onChange(false) when checked and pressed
 *  - Renders error text "请阅读并同意隐私协议" when error=true
 *  - Does NOT render error text when error=false
 *  - Does NOT render error text when error prop is omitted
 *  - testID is forwarded to the container element
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const h = React.createElement;

// ---------------------------------------------------------------------------
// Mock react-native
// ---------------------------------------------------------------------------
vi.mock('react-native', () => {
  function View({ children, style, testID, ...rest }) {
    return h('div', { 'data-testid': testID, style, ...rest }, children);
  }

  function Text({ children, style, testID, ...rest }) {
    return h('span', { 'data-testid': testID, style, ...rest }, children);
  }

  function TouchableOpacity({ children, onPress, testID, style, ...rest }) {
    return h('button', {
      'data-testid': testID,
      onClick: onPress,
      style,
      type: 'button',
      ...rest,
    }, children);
  }

  return { View, Text, TouchableOpacity };
});

// ---------------------------------------------------------------------------
// Load module under test
// ---------------------------------------------------------------------------
async function loadModule() {
  vi.resetModules();
  const mod = await import('../../components/PrivacyCheckbox.jsx');
  return mod;
}

describe('PrivacyCheckbox', () => {
  let PrivacyCheckbox;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await loadModule();
    PrivacyCheckbox = mod.PrivacyCheckbox;
  });

  // -------------------------------------------------------------------------
  // Basic rendering
  // -------------------------------------------------------------------------

  it('renders without crashing', () => {
    expect(() =>
      render(h(PrivacyCheckbox, { checked: false, onChange: vi.fn() }))
    ).not.toThrow();
  });

  it('renders the agreement text', () => {
    render(h(PrivacyCheckbox, { checked: false, onChange: vi.fn() }));
    expect(screen.getByText('我已阅读并同意隐私协议')).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // checked state — icon rendering
  // -------------------------------------------------------------------------

  it('renders checkbox-checked-icon when checked=true', () => {
    render(h(PrivacyCheckbox, { checked: true, onChange: vi.fn() }));
    expect(screen.getByTestId('checkbox-checked-icon')).toBeDefined();
  });

  it('does NOT render checkbox-checked-icon when checked=false', () => {
    render(h(PrivacyCheckbox, { checked: false, onChange: vi.fn() }));
    expect(screen.queryByTestId('checkbox-checked-icon')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // onChange callback
  // -------------------------------------------------------------------------

  it('calls onChange(true) when unchecked checkbox is pressed', () => {
    const onChange = vi.fn();
    render(h(PrivacyCheckbox, {
      checked: false,
      onChange,
      testID: 'privacy-checkbox',
    }));

    // The TouchableOpacity wraps both checkbox and text; click the button
    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('calls onChange(false) when checked checkbox is pressed', () => {
    const onChange = vi.fn();
    render(h(PrivacyCheckbox, {
      checked: true,
      onChange,
      testID: 'privacy-checkbox',
    }));

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('calls onChange with the toggled value (!checked)', () => {
    const onChange = vi.fn();

    // Render unchecked (false), press → should call onChange(true)
    const { rerender } = render(h(PrivacyCheckbox, { checked: false, onChange }));
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenLastCalledWith(true);

    // Simulate parent updating state: now checked=true, press → should call onChange(false)
    rerender(h(PrivacyCheckbox, { checked: true, onChange }));
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  // -------------------------------------------------------------------------
  // error prop
  // -------------------------------------------------------------------------

  it('renders error text when error=true', () => {
    render(h(PrivacyCheckbox, {
      checked: false,
      onChange: vi.fn(),
      error: true,
    }));

    expect(screen.getByText('请阅读并同意隐私协议')).toBeDefined();
  });

  it('does NOT render error text when error=false', () => {
    render(h(PrivacyCheckbox, {
      checked: false,
      onChange: vi.fn(),
      error: false,
    }));

    expect(screen.queryByText('请阅读并同意隐私协议')).toBeNull();
  });

  it('does NOT render error text when error prop is omitted', () => {
    render(h(PrivacyCheckbox, {
      checked: false,
      onChange: vi.fn(),
    }));

    expect(screen.queryByText('请阅读并同意隐私协议')).toBeNull();
  });

  it('renders error text alongside checked-icon simultaneously', () => {
    // Checked=true with error=true: both icon and error message should appear
    render(h(PrivacyCheckbox, {
      checked: true,
      onChange: vi.fn(),
      error: true,
    }));

    expect(screen.getByTestId('checkbox-checked-icon')).toBeDefined();
    expect(screen.getByText('请阅读并同意隐私协议')).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // testID forwarding
  // -------------------------------------------------------------------------

  it('attaches testID to the container element', () => {
    render(h(PrivacyCheckbox, {
      checked: false,
      onChange: vi.fn(),
      testID: 'privacy-checkbox-container',
    }));

    expect(screen.getByTestId('privacy-checkbox-container')).toBeDefined();
  });
});
