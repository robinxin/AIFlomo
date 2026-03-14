/**
 * AuthSubmitButton — 认证表单提交按钮
 *
 * 职责：封装认证表单的提交按钮，处理加载状态、禁用状态及文字切换逻辑。
 *       loading=true 时按钮禁用并显示 loadingLabel；
 *       disabled=true 时按钮禁用；两者独立叠加。
 *
 * Props:
 *   label        {string}   必填 - 正常状态下按钮文字（如"注册"、"登录"）
 *   loadingLabel {string}   必填 - 加载状态下按钮文字（如"注册中..."、"登录中..."）
 *   loading      {boolean}  必填 - 是否处于加载状态
 *   onPress      {function} 必填 - 点击回调 () => void
 *   disabled     {boolean}  可选 - 额外禁用条件，叠加到 loading 之上
 *   testID       {string}   可选 - E2E 测试定位 ID，传递给按钮元素
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

const COLORS = {
  button: {
    active: '#3B82F6',
    disabled: '#9CA3AF',
  },
  text: {
    active: '#FFFFFF',
    disabled: '#FFFFFF',
  },
};

export function AuthSubmitButton({
  label,
  loadingLabel,
  loading,
  onPress,
  disabled = false,
  testID,
}) {
  const isDisabled = loading || disabled;
  const buttonText = loading ? loadingLabel : label;

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={[styles.button, isDisabled && styles.buttonDisabled]}
    >
      <Text style={styles.text}>{buttonText}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.button.active,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  buttonDisabled: {
    backgroundColor: COLORS.button.disabled,
    opacity: 0.6,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text.active,
  },
});
