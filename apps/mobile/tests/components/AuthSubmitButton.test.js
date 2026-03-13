/**
 * AuthSubmitButton 组件单元测试（Vitest）
 *
 * 覆盖范围：
 *   - 正常状态下显示 label，可点击，触发 onPress
 *   - loading=true 时显示 loadingLabel，按钮禁用，不触发 onPress
 *   - disabled=true 时按钮禁用，不触发 onPress
 *   - loading=true 且 disabled=true 同时时，按钮禁用
 *   - loading=false 且 disabled=false 时按钮可点击
 *   - testID prop 正确传递
 *
 * 测试在 RED 阶段编写，实现代码尚未存在，预期全部失败。
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock: react-native
// ---------------------------------------------------------------------------

vi.mock('react-native', async () => {
  const RN = await vi.importActual('react-native');
  return {
    ...RN,
    TouchableOpacity: ({ onPress, children, testID, disabled, style, ...props }) =>
      React.createElement(
        'button',
        {
          onClick: !disabled ? onPress : undefined,
          'data-testid': testID,
          disabled: disabled === true,
          style,
          ...props,
        },
        children
      ),
    ActivityIndicator: ({ testID }) => React.createElement('span', { 'data-testid': testID || 'activity-indicator' }, '...' ),
    Text: ({ children, style, testID, ...props }) =>
      React.createElement('span', { 'data-testid': testID, style, ...props }, children),
    View: ({ children, style, testID, ...props }) =>
      React.createElement('div', { 'data-testid': testID, style, ...props }, children),
    StyleSheet: { create: (s) => s },
  };
});

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

import { AuthSubmitButton } from '../../components/AuthSubmitButton.jsx';

// ---------------------------------------------------------------------------
// 正常状态（loading=false, disabled=false）
// ---------------------------------------------------------------------------

describe('AuthSubmitButton — 正常状态', () => {
  it('显示 label 文字', () => {
    render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={false}
        onPress={vi.fn()}
      />
    );
    expect(screen.getByText('注册')).toBeTruthy();
  });

  it('不显示 loadingLabel', () => {
    render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={false}
        onPress={vi.fn()}
      />
    );
    expect(screen.queryByText('注册中...')).toBeNull();
  });

  it('按钮可点击，点击触发 onPress', () => {
    const onPress = vi.fn();
    render(
      <AuthSubmitButton
        label="登录"
        loadingLabel="登录中..."
        loading={false}
        onPress={onPress}
        testID="btn-submit"
      />
    );
    fireEvent.click(screen.getByTestId('btn-submit'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('按钮不处于禁用状态', () => {
    render(
      <AuthSubmitButton
        label="登录"
        loadingLabel="登录中..."
        loading={false}
        onPress={vi.fn()}
        testID="btn-submit"
      />
    );
    expect(screen.getByTestId('btn-submit').disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// loading=true 状态
// ---------------------------------------------------------------------------

describe('AuthSubmitButton — loading=true', () => {
  it('显示 loadingLabel 文字', () => {
    render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={true}
        onPress={vi.fn()}
      />
    );
    expect(screen.getByText('注册中...')).toBeTruthy();
  });

  it('不显示 label 文字（已替换为 loadingLabel）', () => {
    render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={true}
        onPress={vi.fn()}
      />
    );
    expect(screen.queryByText('注册')).toBeNull();
  });

  it('按钮处于禁用状态', () => {
    render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={true}
        onPress={vi.fn()}
        testID="btn-submit"
      />
    );
    expect(screen.getByTestId('btn-submit').disabled).toBe(true);
  });

  it('按钮禁用时，点击不触发 onPress', () => {
    const onPress = vi.fn();
    render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={true}
        onPress={onPress}
        testID="btn-submit"
      />
    );
    fireEvent.click(screen.getByTestId('btn-submit'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('loading 状态下显示 loadingLabel（登录场景）', () => {
    render(
      <AuthSubmitButton
        label="登录"
        loadingLabel="登录中..."
        loading={true}
        onPress={vi.fn()}
      />
    );
    expect(screen.getByText('登录中...')).toBeTruthy();
    expect(screen.queryByText('登录')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// disabled=true 状态
// ---------------------------------------------------------------------------

describe('AuthSubmitButton — disabled=true', () => {
  it('按钮处于禁用状态', () => {
    render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={false}
        onPress={vi.fn()}
        disabled={true}
        testID="btn-submit"
      />
    );
    expect(screen.getByTestId('btn-submit').disabled).toBe(true);
  });

  it('按钮禁用时，点击不触发 onPress', () => {
    const onPress = vi.fn();
    render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={false}
        onPress={onPress}
        disabled={true}
        testID="btn-submit"
      />
    );
    fireEvent.click(screen.getByTestId('btn-submit'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('disabled=true 且 loading=false 时，仍显示 label（非 loadingLabel）', () => {
    render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={false}
        onPress={vi.fn()}
        disabled={true}
      />
    );
    expect(screen.getByText('注册')).toBeTruthy();
    expect(screen.queryByText('注册中...')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// loading 和 disabled 同时为 true
// ---------------------------------------------------------------------------

describe('AuthSubmitButton — loading=true 且 disabled=true', () => {
  it('按钮处于禁用状态', () => {
    render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={true}
        onPress={vi.fn()}
        disabled={true}
        testID="btn-submit"
      />
    );
    expect(screen.getByTestId('btn-submit').disabled).toBe(true);
  });

  it('显示 loadingLabel', () => {
    render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={true}
        onPress={vi.fn()}
        disabled={true}
      />
    );
    expect(screen.getByText('注册中...')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// loading 状态切换（loading=false → true → false）
// ---------------------------------------------------------------------------

describe('AuthSubmitButton — 状态切换', () => {
  it('loading 从 false 切换为 true — 按钮变为禁用并显示 loadingLabel', () => {
    const { rerender } = render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={false}
        onPress={vi.fn()}
        testID="btn-submit"
      />
    );

    expect(screen.getByText('注册')).toBeTruthy();
    expect(screen.getByTestId('btn-submit').disabled).toBe(false);

    rerender(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={true}
        onPress={vi.fn()}
        testID="btn-submit"
      />
    );

    expect(screen.getByText('注册中...')).toBeTruthy();
    expect(screen.getByTestId('btn-submit').disabled).toBe(true);
  });

  it('loading 从 true 切换为 false — 按钮恢复可点击并显示 label', () => {
    const { rerender } = render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={true}
        onPress={vi.fn()}
        testID="btn-submit"
      />
    );

    expect(screen.getByText('注册中...')).toBeTruthy();

    rerender(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={false}
        onPress={vi.fn()}
        testID="btn-submit"
      />
    );

    expect(screen.getByText('注册')).toBeTruthy();
    expect(screen.getByTestId('btn-submit').disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// testID prop
// ---------------------------------------------------------------------------

describe('AuthSubmitButton — testID prop', () => {
  it('传入 testID 时，按钮有对应的 testID 属性', () => {
    render(
      <AuthSubmitButton
        label="注册"
        loadingLabel="注册中..."
        loading={false}
        onPress={vi.fn()}
        testID="btn-register"
      />
    );
    expect(screen.getByTestId('btn-register')).toBeTruthy();
  });
});
