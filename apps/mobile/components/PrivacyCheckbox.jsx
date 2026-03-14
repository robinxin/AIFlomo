/**
 * PrivacyCheckbox — 隐私协议复选框组件
 *
 * 职责：封装隐私协议勾选交互，支持选中状态、错误提示及测试定位。
 *       点击整个组件区域即可切换 checked 状态；
 *       error=true 时在复选框下方显示红色错误提示。
 *
 * Props:
 *   checked   {boolean}  必填 - 复选框是否选中
 *   onChange  {function} 必填 - 点击时调用，传入 !checked
 *   error     {boolean}  可选 - 是否显示错误提示文字
 *   testID    {string}   可选 - E2E 测试定位 ID，传递给最外层 TouchableOpacity
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const COLORS = {
  checkbox: {
    border: '#D1D5DB',
    borderChecked: '#3B82F6',
    background: '#FFFFFF',
    backgroundChecked: '#EFF6FF',
    checkmark: '#3B82F6',
  },
  label: '#374151',
  error: '#dc2626',
};

export function PrivacyCheckbox({ checked, onChange, error, testID }) {
  function handlePress() {
    onChange(!checked);
  }

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity
        testID={testID}
        onPress={handlePress}
        style={styles.row}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkbox,
            checked && styles.checkboxChecked,
          ]}
        >
          {checked && (
            <Text testID="checkbox-checked-icon" style={styles.checkmark}>
              ✓
            </Text>
          )}
        </View>

        <Text style={styles.label}>我已阅读并同意隐私协议</Text>
      </TouchableOpacity>

      {error && (
        <Text style={styles.errorText}>请阅读并同意隐私协议</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1.5,
    borderRadius: 4,
    borderColor: COLORS.checkbox.border,
    backgroundColor: COLORS.checkbox.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxChecked: {
    borderColor: COLORS.checkbox.borderChecked,
    backgroundColor: COLORS.checkbox.backgroundChecked,
  },
  checkmark: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.checkbox.checkmark,
    lineHeight: 16,
  },
  label: {
    fontSize: 14,
    color: COLORS.label,
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
    marginLeft: 28,
  },
});
