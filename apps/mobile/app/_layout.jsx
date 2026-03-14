/**
 * _layout.jsx
 *
 * Root layout for the AIFlomo Expo Router application.
 * Route: / (applies to all child routes)
 *
 * Responsibilities:
 *  1. Mounts AuthProvider so that every descendant route can call useAuth().
 *  2. Implements a route guard inside RootLayoutInner:
 *     - While loading=true  → shows a full-screen ActivityIndicator (防闪屏).
 *     - While unauthenticated → redirects to /login via router.replace().
 *     - While authenticated but on /login or /register → redirects to / via router.replace().
 *     - Otherwise → renders <Slot /> (the matched child route).
 *
 * Split into two components so that the guard (RootLayoutInner) can call
 * useAuth() which requires being inside AuthProvider.
 */

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, useRouter, usePathname } from 'expo-router';
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';

// ---------------------------------------------------------------------------
// Auth-guarded pages list
// ---------------------------------------------------------------------------

/** Routes that are publicly accessible (no auth required). */
const PUBLIC_ROUTES = ['/login', '/register'];

// ---------------------------------------------------------------------------
// RootLayoutInner — must be rendered inside AuthProvider
// ---------------------------------------------------------------------------

/**
 * Inner layout component that consumes useAuth() to implement the route guard.
 *
 * Rendering logic:
 *  1. loading=true  → full-screen loading placeholder (防闪屏).
 *  2. !isAuthenticated → router.replace('/login') + null.
 *  3. isAuthenticated && pathname is a public route → router.replace('/') + null.
 *  4. Otherwise → <Slot /> (renders the matched child route).
 */
function RootLayoutInner() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Guard 1: waiting for session check — show loader to prevent flash of content
  if (loading) {
    return (
      <View style={STYLES.loadingContainer} testID="root-loading">
        <ActivityIndicator
          size="large"
          color="#3B82F6"
          testID="root-activity-indicator"
        />
      </View>
    );
  }

  // Guard 2: unauthenticated — redirect to login (side effect in useEffect)
  React.useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [loading, isAuthenticated, router]);

  // Guard 3: authenticated user visiting a public route — redirect to home (side effect in useEffect)
  React.useEffect(() => {
    if (!loading && isAuthenticated && PUBLIC_ROUTES.includes(pathname)) {
      router.replace('/');
    }
  }, [loading, isAuthenticated, pathname, router]);

  // Render null while redirecting to prevent flash of protected content
  if (!isAuthenticated || PUBLIC_ROUTES.includes(pathname)) {
    return null;
  }

  // Authenticated and on a protected route — render the matched page
  return <Slot />;
}

// ---------------------------------------------------------------------------
// RootLayout — exported default, wraps everything with AuthProvider
// ---------------------------------------------------------------------------

/**
 * Root Expo Router layout.
 *
 * Wraps all child routes with AuthProvider so that auth state is available
 * everywhere via useAuth(). The route guard runs inside RootLayoutInner
 * which is a child of the provider.
 */
export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutInner />
    </AuthProvider>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const STYLES = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
});
