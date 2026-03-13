/**
 * AuthFormError — form-level error message display
 *
 * Renders a red error card when `message` is non-empty.
 * Returns null (renders nothing) when message is null, undefined, or empty string.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export function AuthFormError({ message, testID }) {
  if (!message) {
    return null;
  }

  return (
    <View style={styles.container} testID={testID}>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFE0E0',
    borderColor: '#FF3B30',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  text: {
    color: '#CC0000',
    fontSize: 14,
  },
});

export default AuthFormError;
