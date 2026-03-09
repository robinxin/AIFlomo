import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { useAuthActions } from '@/hooks/use-auth';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthActions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateEmail = (value) => {
    if (!value) {
      return '请输入邮箱';
    }
    if (!EMAIL_REGEX.test(value)) {
      return '请输入有效的邮箱地址';
    }
    if (value.length > 255) {
      return '邮箱长度不能超过 255 个字符';
    }
    return '';
  };

  const validatePassword = (value) => {
    if (!value) {
      return '请输入密码';
    }
    return '';
  };

  const handleEmailChange = (value) => {
    setEmail(value);
    if (emailError) setEmailError('');
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    if (passwordError) setPasswordError('');
  };

  const handleSubmit = async () => {
    const emailErr = validateEmail(email);
    const passwordErr = validatePassword(password);

    setEmailError(emailErr);
    setPasswordError(passwordErr);

    if (emailErr || passwordErr) {
      return;
    }

    setIsSubmitting(true);

    const result = await login(email.toLowerCase().trim(), password);

    setIsSubmitting(false);

    if (result.success) {
      router.replace('/');
    } else {
      Alert.alert('登录失败', result.error || '邮箱或密码错误');
    }
  };

  const handleGoToRegister = () => {
    router.replace('/register');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>登录</Text>
        <Text style={styles.subtitle}>欢迎回到 AIFlomo</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          label="邮箱"
          value={email}
          onChangeText={handleEmailChange}
          placeholder="请输入邮箱地址"
          keyboardType="email-address"
          autoCapitalize="none"
          error={emailError}
        />

        <TextInput
          label="密码"
          value={password}
          onChangeText={handlePasswordChange}
          placeholder="请输入密码"
          secureTextEntry
          autoCapitalize="none"
          error={passwordError}
        />

        <Button
          title="登录"
          onPress={handleSubmit}
          disabled={isSubmitting}
          loading={isSubmitting}
          variant="primary"
        />

        <Pressable onPress={handleGoToRegister} style={styles.linkContainer}>
          <Text style={styles.linkText}>还没有账号？立即注册</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 24,
  },
  header: {
    marginBottom: 32,
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  form: {
    width: '100%',
  },
  linkContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkText: {
    fontSize: 14,
    color: '#4caf50',
    textDecorationLine: 'underline',
  },
});
