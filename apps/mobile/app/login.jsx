/**
 * login.jsx — 登录页面
 *
 * 职责：收集邮箱和密码，调用 useAuth().login()，
 *       成功后跳转到主页，失败时展示相应错误信息。
 *
 * 路由：/login（Expo Router 文件路由）
 * 依赖：AuthContext（useAuth）、expo-router（useRouter）、三个认证通用组件
 *
 * 特别说明：
 * - 登录页面不做失焦实时验证（与注册页不同）
 * - 401 错误时：密码框自动清空，邮箱框保留原内容
 * - 网络错误时：显示"网络连接失败，请稍后重试"
 */

import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthFormInput } from '../components/AuthFormInput.jsx';
import { AuthFormError } from '../components/AuthFormError.jsx';
import { AuthSubmitButton } from '../components/AuthSubmitButton.jsx';

// ── Component ─────────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();

  // Form field values
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Server-side / global form error
  const [serverError, setServerError] = useState('');

  // Submission loading state
  const [loading, setLoading] = useState(false);

  // ── Submit handler ────────────────────────────────────────────────────────

  async function handleSubmit() {
    // Clear previous server error and enter loading state
    setServerError('');
    setLoading(true);

    try {
      await login(email, password);
      router.replace('/');
    } catch (err) {
      // 401 错误：密码框清空，邮箱框保留
      if (err.status === 401) {
        setPassword('');
        setServerError('邮箱或密码错误，请重试');
      } else {
        setServerError(err.message || '登录失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Navigate to register ──────────────────────────────────────────────────

  function handleGoToRegister() {
    // Clear all form fields and error states
    setEmail('');
    setPassword('');
    setServerError('');

    router.push('/register');
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} testID="login-screen">
      <View style={styles.form}>
        {/* Server-side error */}
        <AuthFormError
          message={serverError}
          testID="form-error"
        />

        {/* Email */}
        <AuthFormInput
          label="邮箱"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          maxLength={200}
          editable={!loading}
          testID="email-input"
        />

        {/* Password */}
        <AuthFormInput
          label="密码"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          maxLength={20}
          editable={!loading}
          testID="password-input"
        />

        {/* Submit button */}
        <AuthSubmitButton
          label="登录"
          loadingLabel="登录中..."
          loading={loading}
          onPress={handleSubmit}
          testID="login-submit-button"
        />

        {/* Navigate to register */}
        <TouchableOpacity
          testID="go-to-register-link"
          onPress={handleGoToRegister}
          style={styles.linkWrapper}
        >
          <Text style={styles.linkText}>没有账号？立即注册</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  form: {
    padding: 24,
  },
  linkWrapper: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#3B82F6',
  },
});
