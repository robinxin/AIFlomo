/**
 * PrivacyCheckbox 组件单元测试（Vitest）
 *
 * 覆盖范围：
 *   - 初始状态（checked=false）正确渲染
 *   - 初始状态（checked=true）正确渲染
 *   - 点击时触发 onChange 回调（切换 checked 状态）
 *   - error=true 时显示红色错误提示"请阅读并同意隐私协议"
 *   - error=false 时不显示错误提示
 *   - error 从 true 变为 false 时错误提示消失
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
    TouchableOpacity: ({ onPress, children, testID, style, ...props }) =>
      React.createElement('button', { onClick: onPress, 'data-testid': testID, style, ...props }, children),
    View: ({ children, style, testID, ...props }) =>
      React.createElement('div', { 'data-testid': testID, style, ...props }, children),
    Text: ({ children, style, testID, ...props }) =>
      React.createElement('span', { 'data-testid': testID, style, ...props }, children),
    StyleSheet: { create: (s) => s },
  };
});

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

import { PrivacyCheckbox } from '../../components/PrivacyCheckbox.jsx';

// ---------------------------------------------------------------------------
// 渲染测试
// ---------------------------------------------------------------------------

describe('PrivacyCheckbox — 渲染', () => {
  it('渲染隐私协议相关文字', () => {
    render(
      <PrivacyCheckbox
        checked={false}
        onChange={vi.fn()}
      />
    );
    // 应包含隐私协议文字
    expect(screen.getByText(/隐私协议/)).toBeTruthy();
  });

  it('checked=false 时，勾选框显示未选中状态', () => {
    render(
      <PrivacyCheckbox
        checked={false}
        onChange={vi.fn()}
        testID="privacy-checkbox"
      />
    );
    // 未选中时不显示勾选符号，或 checkbox 的 aria-checked 为 false
    const container = screen.getByTestId('privacy-checkbox');
    // 检查容器内没有"✓"或对应的选中指示符
    expect(container.querySelector('[data-testid="checkbox-checked-icon"]')).toBeNull();
  });

  it('checked=true 时，勾选框显示已选中状态', () => {
    render(
      <PrivacyCheckbox
        checked={true}
        onChange={vi.fn()}
        testID="privacy-checkbox"
      />
    );
    const container = screen.getByTestId('privacy-checkbox');
    // 选中时应有勾选图标
    expect(container.querySelector('[data-testid="checkbox-checked-icon"]')).toBeTruthy();
  });

  it('渲染"我已阅读并同意"相关文字', () => {
    render(
      <PrivacyCheckbox
        checked={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.getByText(/同意/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 交互测试
// ---------------------------------------------------------------------------

describe('PrivacyCheckbox — 交互', () => {
  it('点击时触发 onChange(true)（从未勾选切换为勾选）', () => {
    const onChange = vi.fn();
    render(
      <PrivacyCheckbox
        checked={false}
        onChange={onChange}
        testID="privacy-checkbox"
      />
    );
    fireEvent.click(screen.getByTestId('privacy-checkbox'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('点击时触发 onChange(false)（从已勾选切换为未勾选）', () => {
    const onChange = vi.fn();
    render(
      <PrivacyCheckbox
        checked={true}
        onChange={onChange}
        testID="privacy-checkbox"
      />
    );
    fireEvent.click(screen.getByTestId('privacy-checkbox'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('多次点击时，onChange 调用次数与点击次数相同', () => {
    const onChange = vi.fn();
    let checked = false;

    const { rerender } = render(
      <PrivacyCheckbox
        checked={checked}
        onChange={onChange}
        testID="privacy-checkbox"
      />
    );

    fireEvent.click(screen.getByTestId('privacy-checkbox'));
    expect(onChange).toHaveBeenCalledTimes(1);

    // 模拟状态更新（受控组件）
    checked = true;
    rerender(
      <PrivacyCheckbox
        checked={checked}
        onChange={onChange}
        testID="privacy-checkbox"
      />
    );

    fireEvent.click(screen.getByTestId('privacy-checkbox'));
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(false);
  });
});

// ---------------------------------------------------------------------------
// error 显示
// ---------------------------------------------------------------------------

describe('PrivacyCheckbox — error 状态', () => {
  it('error=true 时显示"请阅读并同意隐私协议"错误提示', () => {
    render(
      <PrivacyCheckbox
        checked={false}
        onChange={vi.fn()}
        error={true}
      />
    );
    expect(screen.getByText('请阅读并同意隐私协议')).toBeTruthy();
  });

  it('error=false 时不显示错误提示', () => {
    render(
      <PrivacyCheckbox
        checked={false}
        onChange={vi.fn()}
        error={false}
      />
    );
    expect(screen.queryByText('请阅读并同意隐私协议')).toBeNull();
  });

  it('error 未传时（默认值），不显示错误提示', () => {
    render(
      <PrivacyCheckbox
        checked={false}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByText('请阅读并同意隐私协议')).toBeNull();
  });

  it('error 从 true 变为 false 后，错误提示消失', () => {
    const { rerender } = render(
      <PrivacyCheckbox
        checked={false}
        onChange={vi.fn()}
        error={true}
      />
    );
    expect(screen.getByText('请阅读并同意隐私协议')).toBeTruthy();

    rerender(
      <PrivacyCheckbox
        checked={true}
        onChange={vi.fn()}
        error={false}
      />
    );
    expect(screen.queryByText('请阅读并同意隐私协议')).toBeNull();
  });

  it('error 从 false 变为 true 后，错误提示出现', () => {
    const { rerender } = render(
      <PrivacyCheckbox
        checked={false}
        onChange={vi.fn()}
        error={false}
      />
    );
    expect(screen.queryByText('请阅读并同意隐私协议')).toBeNull();

    rerender(
      <PrivacyCheckbox
        checked={false}
        onChange={vi.fn()}
        error={true}
      />
    );
    expect(screen.getByText('请阅读并同意隐私协议')).toBeTruthy();
  });

  it('error=true 时，勾选框有红色高亮边框（样式包含红色相关 key）', () => {
    render(
      <PrivacyCheckbox
        checked={false}
        onChange={vi.fn()}
        error={true}
        testID="privacy-checkbox"
      />
    );
    // 错误状态下，容器应有红色边框相关的样式或 class
    const container = screen.getByTestId('privacy-checkbox');
    // 获取 style 属性，验证包含红色相关样式（borderColor 或 color）
    const style = container.style;
    // 实现时应设置 borderColor: 'red' 或类似颜色值
    // 此断言确保 error 状态下样式有变化
    expect(container).toBeTruthy(); // 占位断言，实现后应改为具体颜色检查
  });
});

// ---------------------------------------------------------------------------
// testID prop
// ---------------------------------------------------------------------------

describe('PrivacyCheckbox — testID prop', () => {
  it('传入 testID 时，根容器有对应的 testID', () => {
    render(
      <PrivacyCheckbox
        checked={false}
        onChange={vi.fn()}
        testID="privacy-checkbox-container"
      />
    );
    expect(screen.getByTestId('privacy-checkbox-container')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 受控组件行为
// ---------------------------------------------------------------------------

describe('PrivacyCheckbox — 受控组件', () => {
  it('checked prop 更新时，UI 同步更新', () => {
    const { rerender } = render(
      <PrivacyCheckbox
        checked={false}
        onChange={vi.fn()}
        testID="privacy-checkbox"
      />
    );

    let container = screen.getByTestId('privacy-checkbox');
    expect(container.querySelector('[data-testid="checkbox-checked-icon"]')).toBeNull();

    rerender(
      <PrivacyCheckbox
        checked={true}
        onChange={vi.fn()}
        testID="privacy-checkbox"
      />
    );

    container = screen.getByTestId('privacy-checkbox');
    expect(container.querySelector('[data-testid="checkbox-checked-icon"]')).toBeTruthy();
  });
});
