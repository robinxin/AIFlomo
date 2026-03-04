import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { dispatch } = useAuth();
  const router = useRouter();

  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleLogin = async () => {
    setError('');

    if (!email || !password) {
      setError('请填写邮箱和密码');
      return;
    }

    if (!validateEmail(email)) {
      setError('请输入有效邮箱地址');
      return;
    }

    setIsLoading(true);
    try {
      const user = await api.post('/api/auth/login', { email, password });
      dispatch({ type: 'LOGIN_SUCCESS', payload: user });
      router.replace('/memo');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>登录</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>邮箱</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            placeholder="请输入邮箱"
            editable={!isLoading}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>密码</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password"
            placeholder="请输入密码"
            editable={!isLoading}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>登录</Text>
          )}
        </Pressable>

        <View style={styles.linkContainer}>
          <Text style={styles.linkText}>还没有账号？</Text>
          <Link href="/register" asChild>
            <Pressable disabled={isLoading}>
              <Text style={styles.link}>立即注册</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    padding: 20,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 24,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  error: {
    color: '#f44336',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#2196F3',
    borderRadius: 4,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  linkText: {
    fontSize: 14,
    color: '#666',
  },
  link: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '600',
    marginLeft: 4,
  },
});
