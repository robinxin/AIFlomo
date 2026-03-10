import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuth } from '@/hooks/use-auth';

export function AuthForm({ mode, onSuccess }) {
  const { login, register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isRegister = mode === 'register';

  async function handleSubmit() {
    setError(null);

    if (!email.trim()) {
      setError('请输入邮箱');
      return;
    }

    if (!password) {
      setError('请输入密码');
      return;
    }

    if (password.length < 8) {
      setError('密码长度不能少于 8 位');
      return;
    }

    if (isRegister && !nickname.trim()) {
      setError('请输入昵称');
      return;
    }

    if (isRegister && nickname.trim().length > 50) {
      setError('昵称长度不能超过 50 个字符');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) {
        await register(email.trim(), password, nickname.trim());
      } else {
        await login(email.trim(), password);
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message ?? (isRegister ? '注册失败，请重试' : '登录失败，请检查邮箱和密码'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>邮箱</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="请输入邮箱"
          placeholderTextColor="#aaa"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          editable={!isSubmitting}
        />
      </View>

      {isRegister ? (
        <View style={styles.field}>
          <Text style={styles.label}>昵称</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="请输入昵称"
            placeholderTextColor="#aaa"
            autoCapitalize="none"
            maxLength={50}
            editable={!isSubmitting}
          />
        </View>
      ) : null}

      <View style={styles.field}>
        <Text style={styles.label}>密码</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="请输入密码（至少 8 位）"
          placeholderTextColor="#aaa"
          secureTextEntry
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          editable={!isSubmitting}
        />
      </View>

      <Pressable
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.submitText}>{isRegister ? '注册' : '登录'}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  errorBox: {
    backgroundColor: '#fdecea',
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
    backgroundColor: '#fafafa',
  },
  submitButton: {
    backgroundColor: '#4caf50',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
