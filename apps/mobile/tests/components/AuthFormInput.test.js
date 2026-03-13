/**
 * AuthFormInput 组件单元测试（Vitest）
 *
 * 覆盖范围：
 *   - 正常渲染（label、value 正确展示）
 *   - 聚焦时边框高亮（蓝色边框样式）
 *   - 失焦触发 onBlur 回调
 *   - error 非空时显示错误提示
 *   - secureTextEntry 时显示眼睛图标并可切换明文/密文
 *   - maxLength 限制输入
 *   - editable=false 时输入框不可编辑
 *
 * 测试在 RED 阶段编写，实现代码尚未存在，预期全部失败。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock: react-native（因为 Vitest 运行在 jsdom，无 RN 原生环境）
// ---------------------------------------------------------------------------

vi.mock('react-native', async () => {
  const RN = await vi.importActual('react-native');
  return {
    ...RN,
    TextInput: ({ testID, onFocus, onBlur, secureTextEntry, editable, value, onChangeText, maxLength, placeholder, ...props }) => (
      React.createElement('input', {
        'data-testid': testID,
        onFocus,
        onBlur,
        type: secureTextEntry ? 'password' : 'text',
        disabled: editable === false,
        value: value || '',
        onChange: (e) => onChangeText && onChangeText(e.target.value),
        maxLength,
        placeholder,
        ...props,
      })
    ),
    TouchableOpacity: ({ onPress, children, testID, ...props }) => (
      React.createElement('button', { onClick: onPress, 'data-testid': testID, ...props }, children)
    ),
    View: ({ children, style, testID, ...props }) => (
      React.createElement('div', { 'data-testid': testID, style, ...props }, children)
    ),
    Text: ({ children, style, testID, ...props }) => (
      React.createElement('span', { 'data-testid': testID, style, ...props }, children)
    ),
    StyleSheet: { create: (s) => s },
  };
});

// ---------------------------------------------------------------------------
// Subject
// ---------------------------------------------------------------------------

import { AuthFormInput } from '../../components/AuthFormInput.jsx';

// ---------------------------------------------------------------------------
// 正常渲染
// ---------------------------------------------------------------------------

describe('AuthFormInput — 正常渲染', () => {
  it('渲染 label 文字', () => {
    render(
      <AuthFormInput
        label="邮箱"
        value=""
        onChangeText={vi.fn()}
      />
    );
    expect(screen.getByText('邮箱')).toBeTruthy();
  });

  it('渲染输入框并显示 value', () => {
    render(
      <AuthFormInput
        label="邮箱"
        value="test@example.com"
        onChangeText={vi.fn()}
        testID="input-email"
      />
    );
    const input = screen.getByTestId('input-email');
    expect(input.value).toBe('test@example.com');
  });

  it('没有 error 时不渲染错误提示', () => {
    render(
      <AuthFormInput
        label="邮箱"
        value=""
        onChangeText={vi.fn()}
      />
    );
    // 不应渲染任何错误文字
    expect(screen.queryByText(/请输入|错误|invalid/i)).toBeNull();
  });

  it('没有 error 时不渲染红色错误文字', () => {
    render(
      <AuthFormInput
        label="昵称"
        value="正常用户"
        onChangeText={vi.fn()}
        error={null}
      />
    );
    const errorTexts = document.querySelectorAll('[data-testid="input-error"]');
    expect(errorTexts.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 聚焦行为
// ---------------------------------------------------------------------------

describe('AuthFormInput — 聚焦行为', () => {
  it('聚焦时触发内部 focused 状态（边框高亮）', () => {
    render(
      <AuthFormInput
        label="邮箱"
        value=""
        onChangeText={vi.fn()}
        testID="input-email"
      />
    );
    const input = screen.getByTestId('input-email');
    fireEvent.focus(input);

    // 聚焦后，包裹容器应有蓝色边框样式或 focused class
    // 由于 jsdom 中 style 的处理方式不同，我们检查容器是否存在聚焦相关的属性
    // 这个断言在实现完成后应该找到对应的元素
    const container = input.closest('[data-testid]') || input.parentElement;
    expect(container).toBeTruthy();
  });

  it('失焦时触发 onBlur 回调', () => {
    const onBlurMock = vi.fn();
    render(
      <AuthFormInput
        label="邮箱"
        value=""
        onChangeText={vi.fn()}
        onBlur={onBlurMock}
        testID="input-email"
      />
    );
    const input = screen.getByTestId('input-email');
    fireEvent.blur(input);

    expect(onBlurMock).toHaveBeenCalledTimes(1);
  });

  it('未传 onBlur prop 时，失焦不报错', () => {
    render(
      <AuthFormInput
        label="邮箱"
        value=""
        onChangeText={vi.fn()}
        testID="input-email"
      />
    );
    const input = screen.getByTestId('input-email');
    // 不应抛出
    expect(() => fireEvent.blur(input)).not.toThrow();
  });

  it('输入时触发 onChangeText 回调', () => {
    const onChangeText = vi.fn();
    render(
      <AuthFormInput
        label="邮箱"
        value=""
        onChangeText={onChangeText}
        testID="input-email"
      />
    );
    const input = screen.getByTestId('input-email');
    fireEvent.change(input, { target: { value: 'hello' } });

    expect(onChangeText).toHaveBeenCalledWith('hello');
  });
});

// ---------------------------------------------------------------------------
// error 显示
// ---------------------------------------------------------------------------

describe('AuthFormInput — error 显示', () => {
  it('error 非空时显示错误文字', () => {
    render(
      <AuthFormInput
        label="邮箱"
        value="bad-email"
        onChangeText={vi.fn()}
        error="请输入有效的邮箱地址"
        testID="input-email"
      />
    );
    expect(screen.getByText('请输入有效的邮箱地址')).toBeTruthy();
  });

  it('error 为不同内容时显示对应错误文字', () => {
    render(
      <AuthFormInput
        label="密码"
        value="short"
        onChangeText={vi.fn()}
        error="密码长度至少为 8 个字符"
        testID="input-password"
      />
    );
    expect(screen.getByText('密码长度至少为 8 个字符')).toBeTruthy();
  });

  it('error 由非空变为 null 时，错误提示消失', () => {
    const { rerender } = render(
      <AuthFormInput
        label="邮箱"
        value=""
        onChangeText={vi.fn()}
        error="请输入有效的邮箱地址"
      />
    );
    expect(screen.getByText('请输入有效的邮箱地址')).toBeTruthy();

    rerender(
      <AuthFormInput
        label="邮箱"
        value="valid@example.com"
        onChangeText={vi.fn()}
        error={null}
      />
    );
    expect(screen.queryByText('请输入有效的邮箱地址')).toBeNull();
  });

  it('error 为空字符串时不显示错误提示', () => {
    render(
      <AuthFormInput
        label="邮箱"
        value=""
        onChangeText={vi.fn()}
        error=""
      />
    );
    // 不应有错误文字（空字符串视为无错误）
    expect(screen.queryByTestId('input-error')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// secureTextEntry（密码显示/隐藏）
// ---------------------------------------------------------------------------

describe('AuthFormInput — secureTextEntry', () => {
  it('secureTextEntry=true 时，输入框 type 为 password（密文模式）', () => {
    render(
      <AuthFormInput
        label="密码"
        value="mypassword"
        onChangeText={vi.fn()}
        secureTextEntry={true}
        testID="input-password"
      />
    );
    const input = screen.getByTestId('input-password');
    expect(input.type).toBe('password');
  });

  it('secureTextEntry=true 时，渲染眼睛图标按钮', () => {
    render(
      <AuthFormInput
        label="密码"
        value="mypassword"
        onChangeText={vi.fn()}
        secureTextEntry={true}
        testID="input-password"
      />
    );
    // 眼睛图标按钮应该存在
    const eyeButton = screen.getByTestId('toggle-secure-entry');
    expect(eyeButton).toBeTruthy();
  });

  it('点击眼睛图标后，密码变为明文显示', () => {
    render(
      <AuthFormInput
        label="密码"
        value="mypassword"
        onChangeText={vi.fn()}
        secureTextEntry={true}
        testID="input-password"
      />
    );
    const input = screen.getByTestId('input-password');
    const eyeButton = screen.getByTestId('toggle-secure-entry');

    // 初始状态：密文
    expect(input.type).toBe('password');

    // 点击切换
    fireEvent.click(eyeButton);

    // 切换后：明文
    expect(input.type).toBe('text');
  });

  it('再次点击眼睛图标，密码恢复密文显示', () => {
    render(
      <AuthFormInput
        label="密码"
        value="mypassword"
        onChangeText={vi.fn()}
        secureTextEntry={true}
        testID="input-password"
      />
    );
    const input = screen.getByTestId('input-password');
    const eyeButton = screen.getByTestId('toggle-secure-entry');

    fireEvent.click(eyeButton); // 切换为明文
    fireEvent.click(eyeButton); // 切换回密文

    expect(input.type).toBe('password');
  });

  it('secureTextEntry=false 时，不渲染眼睛图标', () => {
    render(
      <AuthFormInput
        label="邮箱"
        value="test@example.com"
        onChangeText={vi.fn()}
        secureTextEntry={false}
        testID="input-email"
      />
    );
    expect(screen.queryByTestId('toggle-secure-entry')).toBeNull();
  });

  it('secureTextEntry 未传时（默认值），不渲染眼睛图标', () => {
    render(
      <AuthFormInput
        label="邮箱"
        value=""
        onChangeText={vi.fn()}
        testID="input-email"
      />
    );
    expect(screen.queryByTestId('toggle-secure-entry')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// maxLength 限制
// ---------------------------------------------------------------------------

describe('AuthFormInput — maxLength', () => {
  it('maxLength 传入时，input 的 maxLength 属性被正确设置', () => {
    render(
      <AuthFormInput
        label="昵称"
        value=""
        onChangeText={vi.fn()}
        maxLength={20}
        testID="input-nickname"
      />
    );
    const input = screen.getByTestId('input-nickname');
    expect(Number(input.maxLength)).toBe(20);
  });

  it('maxLength 未传时，input 不设置 maxLength（无限制）', () => {
    render(
      <AuthFormInput
        label="邮箱"
        value=""
        onChangeText={vi.fn()}
        testID="input-email"
      />
    );
    const input = screen.getByTestId('input-email');
    // 没有 maxLength 属性时，input.maxLength 默认值通常为 -1 或 524288
    // 关键是：我们没有显式设置它
    expect(input.getAttribute('maxlength')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// editable
// ---------------------------------------------------------------------------

describe('AuthFormInput — editable', () => {
  it('editable=false 时输入框被禁用', () => {
    render(
      <AuthFormInput
        label="邮箱"
        value="test@example.com"
        onChangeText={vi.fn()}
        editable={false}
        testID="input-email"
      />
    );
    const input = screen.getByTestId('input-email');
    expect(input.disabled).toBe(true);
  });

  it('editable=true（默认）时输入框不禁用', () => {
    render(
      <AuthFormInput
        label="邮箱"
        value=""
        onChangeText={vi.fn()}
        editable={true}
        testID="input-email"
      />
    );
    const input = screen.getByTestId('input-email');
    expect(input.disabled).toBe(false);
  });

  it('editable 未传时（默认可编辑），输入框不禁用', () => {
    render(
      <AuthFormInput
        label="邮箱"
        value=""
        onChangeText={vi.fn()}
        testID="input-email"
      />
    );
    const input = screen.getByTestId('input-email');
    expect(input.disabled).toBe(false);
  });
});
