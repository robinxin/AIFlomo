import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { useCheckAuth } from '@/hooks/use-check-auth';

function RootLayoutNav() {
  const { state } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useCheckAuth();

  useEffect(() => {
    if (state.isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!state.isAuthenticated && !inAuthGroup) {
      router.replace('/login');
    } else if (state.isAuthenticated && inAuthGroup) {
      router.replace('/memo');
    }
  }, [state.isAuthenticated, state.isLoading, segments, router]);

  if (state.isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="memo" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
