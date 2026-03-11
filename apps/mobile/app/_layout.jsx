import { Stack } from 'expo-router';
import { AuthProvider } from '@/context/AuthContext';
import { MemoProvider } from '@/context/MemoContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <MemoProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </MemoProvider>
    </AuthProvider>
  );
}
