import { Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';

/**
 * Button component for actions
 * @param {Object} props
 * @param {string} props.title - Button text
 * @param {Function} props.onPress - Press handler
 * @param {boolean} props.disabled - Whether button is disabled (default: false)
 * @param {boolean} props.loading - Whether button is in loading state (default: false)
 * @param {string} props.variant - Button style variant: 'primary' | 'secondary' (default: 'primary')
 */
export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
}) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
        isDisabled && styles.buttonDisabled,
        pressed && !isDisabled && styles.buttonPressed,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#fff' : '#4caf50'}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'primary' ? styles.buttonTextPrimary : styles.buttonTextSecondary,
            isDisabled && styles.buttonTextDisabled,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  buttonPrimary: {
    backgroundColor: '#4caf50',
  },
  buttonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  buttonDisabled: {
    backgroundColor: '#e0e0e0',
    borderColor: '#e0e0e0',
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  buttonTextPrimary: {
    color: '#fff',
  },
  buttonTextSecondary: {
    color: '#4caf50',
  },
  buttonTextDisabled: {
    color: '#999',
  },
});
