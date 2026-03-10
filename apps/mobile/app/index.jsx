import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthContext } from '@/context/AuthContext';

export default function IndexScreen() {
  const router = useRouter();
  const { state } = useAuthContext();

  useEffect(() => {
    if (state.isLoading) return;
    if (state.isAuthenticated) {
      router.replace('/memo');
    } else {
      router.replace('/login');
    }
  }, [state.isLoading, state.isAuthenticated, router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#4caf50" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
