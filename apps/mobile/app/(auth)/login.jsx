import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function LoginScreen() {
  const { state, login, clearError } = useAuth();
  const { isAuthenticating, error } = state;

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleLogin = async () => {
    if (!username.trim()) {
      setValidationError('请输入用户名');
      return;
    }
    if (!password.trim()) {
      setValidationError('请输入密码');
      return;
    }
    setValidationError('');
    clearError();

    const result = await login(username.trim(), password);
    if (result.success) {
      router.replace('/(app)');
    }
  };

  const displayError = validationError || error;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>AIFlomo</Text>
          <Text style={styles.subtitle}>快速记录，沉淀思想</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>用户名</Text>
          <TextInput
            style={styles.input}
            placeholder="请输入用户名"
            placeholderTextColor="#999"
            value={username}
            onChangeText={(text) => {
              setUsername(text);
              setValidationError('');
            }}
            editable={!isAuthenticating}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>密码</Text>
          <TextInput
            style={styles.input}
            placeholder="请输入密码"
            placeholderTextColor="#999"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setValidationError('');
            }}
            editable={!isAuthenticating}
            secureTextEntry
          />
        </View>

        {displayError ? (
          <Text style={styles.errorText}>{displayError}</Text>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.loginButton,
            (!username || !password || isAuthenticating) && styles.loginButtonDisabled,
            pressed && styles.loginButtonPressed,
          ]}
          onPress={handleLogin}
          disabled={!username || !password || isAuthenticating}
        >
          {isAuthenticating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>登录</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 13,
    marginBottom: 8,
  },
  loginButton: {
    backgroundColor: '#4caf50',
    borderRadius: 8,
    paddingVertical: 14,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  loginButtonDisabled: {
    backgroundColor: '#a5d6a7',
  },
  loginButtonPressed: {
    backgroundColor: '#45a049',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
