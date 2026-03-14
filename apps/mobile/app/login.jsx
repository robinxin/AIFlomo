import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext.jsx';
import { AuthFormInput } from '../components/AuthFormInput.jsx';
import { AuthFormError } from '../components/AuthFormError.jsx';
import { AuthSubmitButton } from '../components/AuthSubmitButton.jsx';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setServerError('');
    setLoading(true);

    try {
      await login(email, password);
      router.replace('/');
    } catch (error) {
      // Clear password on failure, keep email
      setPassword('');
      setServerError('邮箱或密码错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToRegister = () => {
    // Clear form before navigating
    setEmail('');
    setPassword('');
    setServerError('');
    router.push('/register');
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: 24 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 32, color: '#111827' }}>登录</h1>

      <AuthFormError message={serverError} testID="login-server-error" />

      <AuthFormInput
        label="邮箱"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        editable={!loading}
        testID="login-email-input"
      />

      <AuthFormInput
        label="密码"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
        testID="login-password-input"
      />

      <AuthSubmitButton
        label="登录"
        loadingLabel="登录中..."
        loading={loading}
        onPress={handleSubmit}
        testID="login-submit-btn"
      />

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button
          type="button"
          onClick={handleGoToRegister}
          style={{ background: 'none', border: 'none', color: '#3B82F6', cursor: 'pointer', fontSize: 14 }}
          data-testid="go-to-register-link"
        >
          没有账号？立即注册
        </button>
      </div>
    </div>
  );
}
