import React, { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';

/**
 * RouteGuard - Handles authentication-based routing.
 * - While loading: renders nothing (prevents flash)
 * - Unauthenticated users: redirects to /login
 * - Authenticated users visiting /login or /register: redirects to /
 */
function RouteGuard({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const currentPath = segments.join('/');
    const isAuthPage = currentPath === 'login' || currentPath === 'register';

    if (!isAuthenticated && !isAuthPage) {
      // Not logged in - redirect to login
      router.replace('/login');
    } else if (isAuthenticated && isAuthPage) {
      // Already logged in - redirect to main page
      router.replace('/');
    }
  }, [loading, isAuthenticated, segments]);

  if (loading) {
    // Render loading placeholder to prevent flash
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: 16,
          color: '#6B7280',
        }}
        data-testid="auth-loading"
      >
        加载中...
      </div>
    );
  }

  return children;
}

/**
 * RootLayout - Root Expo Router layout.
 * Wraps all child routes with AuthProvider and RouteGuard.
 */
export default function RootLayout({ children }) {
  return (
    <AuthProvider>
      <RouteGuard>
        {children}
      </RouteGuard>
    </AuthProvider>
  );
}
