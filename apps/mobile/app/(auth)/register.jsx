import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter, Link } from 'expo-router';
import { api } from '@/lib/api-client';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const validateEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const validatePassword = (password) => {
    const regex = /^(?=.*[A-Za-z])(?=.*\d)/;
    return password.length >= 8 && password.length <= 20 && regex.test(password);
  };

  const handleRegister = async () => {
    setError('');

    if (!email || !nickname || !password) {
      setError('请填写所有字段');
      return;
    }

    if (!validateEmail(email)) {
      setError('请输入有效邮箱地址');
      return;
    }

    if (nickname.length < 1 || nickname.length > 20) {
      setError('昵称长度为 1-20 字符');
      return;
    }

    if (!validatePassword(password)) {
      setError('密码需为 8-20 位，包含字母和数字');
      return;
    }

    if (!agreePrivacy) {
      setError('请先同意隐私协议');
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/api/auth/register', { email, nickname, password, agreePrivacy });
      router.replace('/memo');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.scrollContent}>
      <View style={styles.container}>
        <View style={styles.formContainer}>
          <Text style={styles.title}>注册</Text>

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
            <Text style={styles.label}>昵称</Text>
            <TextInput
              style={styles.input}
              value={nickname}
              onChangeText={setNickname}
              autoCapitalize="none"
              placeholder="请输入昵称（1-20 字符）"
              maxLength={20}
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
              autoComplete="password-new"
              placeholder="8-20 位，包含字母和数字"
              editable={!isLoading}
            />
          </View>

          <Pressable
            style={styles.checkboxContainer}
            onPress={() => setAgreePrivacy(!agreePrivacy)}
            disabled={isLoading}
          >
            <View style={[styles.checkbox, agreePrivacy && styles.checkboxChecked]}>
              {agreePrivacy && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.checkboxLabel}>
              我已阅读并同意<Text style={styles.linkInline}>《隐私协议》</Text>
            </Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>注册</Text>
            )}
          </Pressable>

          <View style={styles.linkContainer}>
            <Text style={styles.linkText}>已有账号？</Text>
            <Link href="/login" asChild>
              <Pressable disabled={isLoading}>
                <Text style={styles.link}>返回登录</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    flex: 1,
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
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  checkmark: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  linkInline: {
    color: '#2196F3',
    fontWeight: '600',
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
