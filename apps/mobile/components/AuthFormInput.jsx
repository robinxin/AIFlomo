/**
 * AuthFormInput — 通用受控输入框组件
 *
 * 职责：统一封装认证表单中的字段展示、焦点样式、错误提示、密码显示/隐藏切换。
 *
 * Props:
 *   label          {string}   必填 - 输入框标签文字
 *   value          {string}   必填 - 当前输入值（受控）
 *   onChangeText   {function} 必填 - 文字变更回调 (text: string) => void
 *   onBlur         {function} 可选 - 失焦回调 () => void
 *   error          {string}   可选 - 字段错误提示文字
 *   keyboardType   {string}   可选 - React Native keyboardType，默认 'default'
 *   secureTextEntry {boolean} 可选 - 是否为密码模式，默认 false
 *   maxLength      {number}   可选 - 输入字符上限
 *   editable       {boolean}  可选 - 是否可编辑，默认 true
 *   testID         {string}   可选 - E2E 测试定位 ID
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';

const COLORS = {
  border: {
    default: '#D1D5DB',
    focused: '#3B82F6',
    error: '#EF4444',
  },
  label: '#374151',
  error: '#EF4444',
  placeholder: '#9CA3AF',
  background: {
    input: '#FFFFFF',
    disabled: '#F3F4F6',
  },
  text: {
    primary: '#111827',
    toggle: '#6B7280',
  },
};

export function AuthFormInput({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  keyboardType = 'default',
  secureTextEntry = false,
  maxLength,
  editable = true,
  testID,
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const hasError = Boolean(error);

  const borderColor = hasError
    ? COLORS.border.error
    : isFocused
    ? COLORS.border.focused
    : COLORS.border.default;

  function handleFocus() {
    setIsFocused(true);
  }

  function handleBlur() {
    setIsFocused(false);
    if (onBlur) {
      onBlur();
    }
  }

  function handleTogglePasswordVisibility() {
    setIsPasswordVisible((prev) => !prev);
  }

  const effectiveSecureTextEntry = secureTextEntry && !isPasswordVisible;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View style={[styles.inputWrapper, { borderColor }]}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          secureTextEntry={effectiveSecureTextEntry}
          keyboardType={keyboardType}
          maxLength={maxLength}
          editable={editable}
          style={[
            styles.input,
            !editable && styles.inputDisabled,
          ]}
          placeholderTextColor={COLORS.placeholder}
        />

        {secureTextEntry && (
          <TouchableOpacity
            testID="toggle-secure-entry"
            onPress={handleTogglePasswordVisibility}
            style={styles.toggleButton}
          >
            <Text style={styles.toggleButtonText}>
              {isPasswordVisible ? '隐藏' : '显示'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {hasError && (
        <Text testID="input-error" style={styles.errorText}>
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.label,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    backgroundColor: COLORS.background.input,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text.primary,
    paddingVertical: 12,
    minHeight: 44,
  },
  inputDisabled: {
    backgroundColor: COLORS.background.disabled,
    color: COLORS.placeholder,
  },
  toggleButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  toggleButtonText: {
    fontSize: 14,
    color: COLORS.text.toggle,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
  },
});
