/**
 * PrivacyCheckbox.jsx
 *
 * Privacy agreement checkbox for the registration form.
 * Toggles checked state on press and shows an error prompt when
 * the user attempts to submit without agreeing.
 *
 * Named export: PrivacyCheckbox
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

const COLORS = {
  checkboxBorder: '#D1D5DB',   // gray-300
  checkboxBorderError: '#EF4444', // red-500
  checkboxChecked: '#3B82F6',  // blue-500
  checkmark: '#FFFFFF',
  label: '#374151',            // gray-700
  error: '#EF4444',            // red-500
};

const STYLES = {
  container: {
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 12,
    color: COLORS.checkmark,
    fontWeight: 'bold',
  },
  labelText: {
    fontSize: 14,
    color: COLORS.label,
    flex: 1,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
    marginTop: 4,
    marginLeft: 30,
  },
};

export function PrivacyCheckbox({ checked, onChange, error = false, testID }) {
  function handlePress() {
    onChange(!checked);
  }

  const borderColor = error ? COLORS.checkboxBorderError : COLORS.checkboxBorder;
  const backgroundColor = checked ? COLORS.checkboxChecked : 'transparent';

  return (
    <View style={STYLES.container} testID={testID}>
      <TouchableOpacity
        style={STYLES.row}
        onPress={handlePress}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
      >
        <View
          style={[
            STYLES.checkbox,
            { borderColor, backgroundColor },
          ]}
        >
          {checked ? (
            <Text testID="checkbox-checked-icon" style={STYLES.checkmark}>
              ✓
            </Text>
          ) : null}
        </View>

        <Text style={STYLES.labelText}>我已阅读并同意隐私协议</Text>
      </TouchableOpacity>

      {error ? (
        <Text style={STYLES.errorText}>请阅读并同意隐私协议</Text>
      ) : null}
    </View>
  );
}
