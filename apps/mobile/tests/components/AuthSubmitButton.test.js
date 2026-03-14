/**
 * AuthSubmitButton.test.js
 *
 * Unit tests for apps/mobile/components/AuthSubmitButton.jsx
 *
 * Uses React.createElement() instead of JSX to avoid requiring a
 * special Vite/esbuild config for .test.js files.
 *
 * Coverage targets:
 *  - Renders the label in normal state
 *  - Renders loadingLabel when loading=true
 *  - Button is disabled when loading=true
 *  - Button is disabled when disabled=true
 *  - Button is disabled when both loading=true and disabled=true
 *  - Button is enabled when loading=false and disabled=false
 *  - onPress is called when the button is clicked and not disabled
 *  - onPress is NOT called when the button is disabled
 *  - testID is forwarded to the button element
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const h = React.createElement;

// ---------------------------------------------------------------------------
// Mock react-native
// ---------------------------------------------------------------------------
vi.mock('react-native', () => {
  function TouchableOpacity({ children, onPress, disabled, testID, style, ...rest }) {
    return h('button', {
      'data-testid': testID,
      onClick: disabled ? undefined : onPress,
      disabled,
      style,
      ...rest,
    }, children);
  }

  function Text({ children, style, testID, ...rest }) {
    return h('span', { 'data-testid': testID, style, ...rest }, children);
  }

  return { TouchableOpacity, Text };
});

// ---------------------------------------------------------------------------
// Load module under test
// ---------------------------------------------------------------------------
async function loadModule() {
  vi.resetModules();
  const mod = await import('../../components/AuthSubmitButton.jsx');
  return mod;
}

describe('AuthSubmitButton', () => {
  let AuthSubmitButton;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await loadModule();
    AuthSubmitButton = mod.AuthSubmitButton;
  });

  // -------------------------------------------------------------------------
  // Label rendering
  // -------------------------------------------------------------------------

  it('renders the label in normal state', () => {
    render(h(AuthSubmitButton, {
      label: '登录',
      loadingLabel: '登录中...',
      loading: false,
      onPress: vi.fn(),
    }));

    expect(screen.getByText('登录')).toBeDefined();
  });

  it('renders loadingLabel when loading=true', () => {
    render(h(AuthSubmitButton, {
      label: '登录',
      loadingLabel: '登录中...',
      loading: true,
      onPress: vi.fn(),
    }));

    expect(screen.getByText('登录中...')).toBeDefined();
    expect(screen.queryByText('登录')).toBeNull();
  });

  it('renders label (not loadingLabel) when loading=false', () => {
    render(h(AuthSubmitButton, {
      label: '注册',
      loadingLabel: '注册中...',
      loading: false,
      onPress: vi.fn(),
    }));

    expect(screen.getByText('注册')).toBeDefined();
    expect(screen.queryByText('注册中...')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Disabled state
  // -------------------------------------------------------------------------

  it('button is disabled when loading=true', () => {
    render(h(AuthSubmitButton, {
      label: '登录',
      loadingLabel: '登录中...',
      loading: true,
      onPress: vi.fn(),
      testID: 'submit-btn',
    }));

    const btn = screen.getByTestId('submit-btn');
    expect(btn.disabled).toBe(true);
  });

  it('button is disabled when disabled=true', () => {
    render(h(AuthSubmitButton, {
      label: '注册',
      loadingLabel: '注册中...',
      loading: false,
      onPress: vi.fn(),
      disabled: true,
      testID: 'submit-btn',
    }));

    const btn = screen.getByTestId('submit-btn');
    expect(btn.disabled).toBe(true);
  });

  it('button is disabled when both loading=true and disabled=true', () => {
    render(h(AuthSubmitButton, {
      label: '注册',
      loadingLabel: '注册中...',
      loading: true,
      onPress: vi.fn(),
      disabled: true,
      testID: 'submit-btn',
    }));

    const btn = screen.getByTestId('submit-btn');
    expect(btn.disabled).toBe(true);
  });

  it('button is NOT disabled when loading=false and disabled=false', () => {
    render(h(AuthSubmitButton, {
      label: '登录',
      loadingLabel: '登录中...',
      loading: false,
      onPress: vi.fn(),
      disabled: false,
      testID: 'submit-btn',
    }));

    const btn = screen.getByTestId('submit-btn');
    expect(btn.disabled).toBe(false);
  });

  it('button is NOT disabled when loading=false and disabled is omitted', () => {
    render(h(AuthSubmitButton, {
      label: '登录',
      loadingLabel: '登录中...',
      loading: false,
      onPress: vi.fn(),
      testID: 'submit-btn',
    }));

    const btn = screen.getByTestId('submit-btn');
    expect(btn.disabled).toBe(false);
  });

  // -------------------------------------------------------------------------
  // onPress callback
  // -------------------------------------------------------------------------

  it('calls onPress when button is clicked in normal state', () => {
    const onPress = vi.fn();
    render(h(AuthSubmitButton, {
      label: '登录',
      loadingLabel: '登录中...',
      loading: false,
      onPress,
      testID: 'submit-btn',
    }));

    fireEvent.click(screen.getByTestId('submit-btn'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onPress when button is disabled due to loading=true', () => {
    const onPress = vi.fn();
    render(h(AuthSubmitButton, {
      label: '登录',
      loadingLabel: '登录中...',
      loading: true,
      onPress,
      testID: 'submit-btn',
    }));

    fireEvent.click(screen.getByTestId('submit-btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does NOT call onPress when button is disabled due to disabled=true', () => {
    const onPress = vi.fn();
    render(h(AuthSubmitButton, {
      label: '注册',
      loadingLabel: '注册中...',
      loading: false,
      onPress,
      disabled: true,
      testID: 'submit-btn',
    }));

    fireEvent.click(screen.getByTestId('submit-btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does NOT call onPress when both loading=true and disabled=true', () => {
    const onPress = vi.fn();
    render(h(AuthSubmitButton, {
      label: '注册',
      loadingLabel: '注册中...',
      loading: true,
      onPress,
      disabled: true,
      testID: 'submit-btn',
    }));

    fireEvent.click(screen.getByTestId('submit-btn'));
    expect(onPress).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // testID forwarding
  // -------------------------------------------------------------------------

  it('attaches testID to the button element', () => {
    render(h(AuthSubmitButton, {
      label: '登录',
      loadingLabel: '登录中...',
      loading: false,
      onPress: vi.fn(),
      testID: 'login-submit-button',
    }));

    expect(screen.getByTestId('login-submit-button')).toBeDefined();
  });
});
