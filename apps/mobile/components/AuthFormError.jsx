/**
 * AuthFormError — 认证表单全局错误提示卡片
 *
 * 职责：在认证表单顶部展示来自服务端或全局验证的错误信息（如"邮箱或密码错误"）。
 *       message 为 null 或空字符串时不渲染任何内容，保持布局整洁。
 *
 * Props:
 *   message  {string | null}  可选 - 错误提示文字；null 或空字符串时组件返回 null
 *   testID   {string}         可选 - E2E 测试定位 ID，传递给最外层容器
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const COLORS = {
  background: '#FEF2F2',
  border: '#FCA5A5',
  text: '#B91C1C',
};

export function AuthFormError({ message, testID }) {
  if (!message) {
    return null;
  }

  return (
    <View testID={testID} style={styles.container}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  text: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 20,
  },
});
