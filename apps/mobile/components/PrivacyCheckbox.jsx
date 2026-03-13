/**
 * PrivacyCheckbox — privacy policy agreement checkbox
 *
 * Controlled component. Clicking toggles checked state via onChange callback.
 * Shows error highlight when error=true.
 */
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';

export function PrivacyCheckbox({ checked, onChange, error = false, testID }) {
  function handlePress() {
    onChange(!checked);
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      testID={testID}
      style={[styles.container, error && styles.containerError]}
      activeOpacity={0.8}
    >
      <View style={[styles.checkbox, error && styles.checkboxError]}>
        {checked && (
          <Text
            style={styles.checkmark}
            testID="checkbox-checked-icon"
          >
            ✓
          </Text>
        )}
      </View>
      <Text style={styles.label}>我已阅读并同意隐私协议</Text>
      {error && (
        <Text style={styles.errorText}>请阅读并同意隐私协议</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    flexWrap: 'wrap',
  },
  containerError: {
    borderColor: '#FF3B30',
    borderWidth: 1,
    borderRadius: 4,
    padding: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#8E8E93',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxError: {
    borderColor: '#FF3B30',
  },
  checkmark: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 14,
    color: '#3C3C43',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    width: '100%',
    marginTop: 4,
  },
});

export default PrivacyCheckbox;
