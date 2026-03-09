import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { TextInput } from '@/components/TextInput';
import { Button } from '@/components/Button';
import { useAuthActions } from '@/hooks/use-auth';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthActions();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [errors, setErrors] = useState({
    email: '',
    password: '',
    general: '',
  });

  // 邮箱格式验证
  const validateEmail = (value) => {
    if (!value) return '请输入邮箱地址';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) return '请输入有效的邮箱地址';
    if (value.length > 255) return '邮箱地址过长';
    return '';
  };

  // 密码验证
  const validatePassword = (value) => {
    if (!value) return '请输入密码';
    return '';
  };

  // onChange 时清除对应字段的错误
  const handleEmailChange = (value) => {
    setEmail(value);
    if (errors.email || errors.general) {
      setErrors((prev) => ({ ...prev, email: '', general: '' }));
    }
  };

  const handlePasswordChange = (value) => {
    setPassword(value);
    if (errors.password || errors.general) {
      setErrors((prev) => ({ ...prev, password: '', general: '' }));
    }
  };

  // onBlur 时触发字段验证
  const handleEmailBlur = () => {
    const error = validateEmail(email);
    if (error) {
      setErrors((prev) => ({ ...prev, email: error }));
    }
  };

  const handlePasswordBlur = () => {
    const error = validatePassword(password);
    if (error) {
      setErrors((prev) => ({ ...prev, password: error }));
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    // 完整校验所有字段
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    // 如果有任何错误，显示并阻止提交
    if (emailError || passwordError) {
      setErrors({
        email: emailError,
        password: passwordError,
        general: '',
      });
      return;
    }

    // 提交到后端
    setLoading(true);
    const result = await login(email.toLowerCase(), password);
    setLoading(false);

    if (result.success) {
      // 登录成功，跳转到主页面
      router.replace('/memo');
    } else {
      // 登录失败，显示后端返回的错误
      setErrors((prev) => ({
        ...prev,
        general: result.error,
      }));
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.formContainer}>
        <Text style={styles.title}>登录</Text>
        <Text style={styles.subtitle}>使用邮箱和密码登录 AIFlomo</Text>

        {!!errors.general && (
          <View style={styles.generalErrorContainer}>
            <Text style={styles.generalErrorText}>{errors.general}</Text>
          </View>
        )}

        <TextInput
          label="邮箱地址"
          value={email}
          onChangeText={handleEmailChange}
          onBlur={handleEmailBlur}
          keyboardType="email-address"
          placeholder="请输入邮箱地址"
          error={errors.email}
          autoCapitalize="none"
        />

        <TextInput
          label="密码"
          value={password}
          onChangeText={handlePasswordChange}
          onBlur={handlePasswordBlur}
          secureTextEntry
          placeholder="请输入密码"
          error={errors.password}
          autoCapitalize="none"
        />

        <Button
          title="登录"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>还没有账号？</Text>
          <Pressable onPress={() => router.push('/register')}>
            <Text style={styles.link}>立即注册</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  formContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
    textAlign: 'center',
  },
  generalErrorContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  generalErrorText: {
    fontSize: 14,
    color: '#d32f2f',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    marginRight: 4,
  },
  link: {
    fontSize: 14,
    color: '#4caf50',
    fontWeight: '600',
  },
});
