import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';

export function Button({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  ...rest
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
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#fff' : '#4caf50'}
          size="small"
        />
      ) : (
        <Text
          style={[
            styles.text,
            variant === 'primary' ? styles.textPrimary : styles.textSecondary,
            isDisabled && styles.textDisabled,
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
    paddingHorizontal: 16,
  },
  buttonPrimary: {
    backgroundColor: '#4caf50',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
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
  text: {
    fontSize: 16,
    fontWeight: '500',
  },
  textPrimary: {
    color: '#fff',
  },
  textSecondary: {
    color: '#4caf50',
  },
  textDisabled: {
    color: '#999',
  },
});
