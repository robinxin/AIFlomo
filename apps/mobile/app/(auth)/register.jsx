import { View, Text, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthForm } from '@/components/AuthForm';

export default function RegisterScreen() {
  const router = useRouter();

  function handleSuccess() {
    router.replace('/(app)/memo');
  }

  function handleGoLogin() {
    router.push('/(auth)/login');
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.logo}>flomo</Text>
          <Text style={styles.tagline}>低摩擦记录，随时回看</Text>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.title}>注册</Text>
          <AuthForm mode="register" onSuccess={handleSuccess} />

          <View style={styles.footer}>
            <Text style={styles.footerText}>已有账号？</Text>
            <Pressable onPress={handleGoLogin}>
              <Text style={styles.linkText}>立即登录</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#f5f5f0',
  },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 36,
    fontWeight: '700',
    color: '#4caf50',
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: '#888',
    marginTop: 6,
  },
  formCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      },
    }),
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    color: '#222',
    marginBottom: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    gap: 4,
  },
  footerText: {
    fontSize: 14,
    color: '#888',
  },
  linkText: {
    fontSize: 14,
    color: '#4caf50',
    fontWeight: '500',
  },
});
