/**
 * login.jsx — 登录页面
 *
 * 功能：
 *   - 使用 AuthFormInput（邮箱/密码）、AuthFormError、AuthSubmitButton 组合表单
 *   - 无失焦实时验证（登录页简洁，无字段级校验）
 *   - 提交时进入加载状态
 *   - 调用 useAuth().login()，成功后 router.replace('/')
 *   - 失败时（401）表单顶部显示"邮箱或密码错误，请重试"且密码框清空、邮箱框保留
 *   - 网络错误显示"网络连接失败，请稍后重试"
 *   - 点击"立即注册"清空表单并 router.push('/register')
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthFormInput } from '../components/AuthFormInput.jsx';
import { AuthFormError } from '../components/AuthFormError.jsx';
import { AuthSubmitButton } from '../components/AuthSubmitButton.jsx';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setLoading(true);
    setFormError('');

    try {
      await login(email, password);
      router.replace('/');
    } catch (err) {
      const message = err?.message || '';
      if (message.includes('Network') || message.includes('network') || message.includes('Failed to fetch')) {
        setFormError('网络连接失败，请稍后重试');
      } else if (message.includes('邮箱或密码错误')) {
        setFormError('邮箱或密码错误，请重试');
        setPassword('');
      } else {
        setFormError(message || '登录失败，请稍后重试');
        setPassword('');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Navigate to register ─────────────────────────────────────────────────

  function handleGoRegister() {
    setEmail('');
    setPassword('');
    setFormError('');
    router.push('/register');
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>登录</Text>

      <AuthFormError message={formError} testID="login-form-error" />

      <AuthFormInput
        label="邮箱"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        editable={!loading}
        testID="login-email"
      />

      <AuthFormInput
        label="密码"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
        testID="login-password"
      />

      <AuthSubmitButton
        label="登录"
        loadingLabel="登录中..."
        loading={loading}
        onPress={handleSubmit}
        testID="login-submit"
      />

      <TouchableOpacity
        onPress={handleGoRegister}
        style={styles.linkButton}
        testID="login-go-register"
      >
        <Text style={styles.linkText}>没有账号？立即注册</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 24,
    textAlign: 'center',
  },
  linkButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 14,
    color: '#007AFF',
  },
});
