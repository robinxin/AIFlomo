/**
 * _layout.test.js
 *
 * Unit tests for apps/mobile/app/_layout.jsx (RootLayout + RootLayoutInner).
 *
 * Coverage targets:
 *  - loading=true  → renders loading indicator, no Slot, no redirect
 *  - loading=false, !isAuthenticated → router.replace('/login') called, no Slot rendered
 *  - loading=false, isAuthenticated, pathname='/' → renders Slot, no redirect
 *  - loading=false, isAuthenticated, pathname='/login' → router.replace('/') called
 *  - loading=false, isAuthenticated, pathname='/register' → router.replace('/') called
 *  - loading=false, isAuthenticated, pathname='/other' → renders Slot, no redirect
 *  - RootLayout wraps children in AuthProvider (smoke test)
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';

const h = React.createElement;

// ---------------------------------------------------------------------------
// Shared mock state — controlled per test
// ---------------------------------------------------------------------------

let mockAuthState = {
  isAuthenticated: false,
  loading: true,
};

let mockPathname = '/';

const mockRouterReplace = vi.fn();

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../context/AuthContext.jsx', () => ({
  AuthProvider: ({ children }) => h('div', { 'data-testid': 'auth-provider' }, children),
  useAuth: () => mockAuthState,
}));

vi.mock('expo-router', () => ({
  Slot: () => h('div', { 'data-testid': 'slot' }, 'slot-content'),
  useRouter: () => ({ replace: mockRouterReplace }),
  usePathname: () => mockPathname,
}));

vi.mock('react-native', () => {
  function View({ children, style, testID }) {
    return h('div', { 'data-testid': testID, style }, children);
  }
  function ActivityIndicator({ size, color, testID }) {
    return h('div', { 'data-testid': testID, 'data-size': size, 'data-color': color });
  }
  const StyleSheet = {
    create: (styles) => styles,
  };

  return { View, ActivityIndicator, StyleSheet };
});

// ---------------------------------------------------------------------------
// Module loader — re-import after setting mock state
// ---------------------------------------------------------------------------

async function loadRootLayout() {
  vi.resetModules();

  // Re-apply mocks after resetModules so the fresh module picks them up.
  vi.mock('../../context/AuthContext.jsx', () => ({
    AuthProvider: ({ children }) => h('div', { 'data-testid': 'auth-provider' }, children),
    useAuth: () => mockAuthState,
  }));

  vi.mock('expo-router', () => ({
    Slot: () => h('div', { 'data-testid': 'slot' }, 'slot-content'),
    useRouter: () => ({ replace: mockRouterReplace }),
    usePathname: () => mockPathname,
  }));

  vi.mock('react-native', () => {
    function View({ children, style, testID }) {
      return h('div', { 'data-testid': testID, style }, children);
    }
    function ActivityIndicator({ size, color, testID }) {
      return h('div', { 'data-testid': testID, 'data-size': size, 'data-color': color });
    }
    const StyleSheet = {
      create: (styles) => styles,
    };
    return { View, ActivityIndicator, StyleSheet };
  });

  const mod = await import('../../app/_layout.jsx');
  return mod.default;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RootLayout (_layout.jsx)', () => {
  let RootLayout;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset to safe defaults before each test
    mockAuthState = { isAuthenticated: false, loading: true };
    mockPathname = '/';
    RootLayout = await loadRootLayout();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // AuthProvider wrapper
  // -------------------------------------------------------------------------

  describe('AuthProvider wrapping', () => {
    it('renders AuthProvider as the root element', () => {
      render(h(RootLayout, null));
      expect(screen.getByTestId('auth-provider')).toBeDefined();
    });

    it('renders inner content inside AuthProvider', () => {
      render(h(RootLayout, null));
      // The loading indicator is inside AuthProvider when loading=true
      const provider = screen.getByTestId('auth-provider');
      expect(provider).toBeDefined();
    });
  });

  // -------------------------------------------------------------------------
  // Guard 1: loading state
  // -------------------------------------------------------------------------

  describe('when loading=true', () => {
    beforeEach(async () => {
      mockAuthState = { isAuthenticated: false, loading: true };
      RootLayout = await loadRootLayout();
    });

    it('renders the loading container', () => {
      render(h(RootLayout, null));
      expect(screen.getByTestId('root-loading')).toBeDefined();
    });

    it('renders the ActivityIndicator', () => {
      render(h(RootLayout, null));
      expect(screen.getByTestId('root-activity-indicator')).toBeDefined();
    });

    it('does NOT render the Slot', () => {
      render(h(RootLayout, null));
      expect(screen.queryByTestId('slot')).toBeNull();
    });

    it('does NOT call router.replace', () => {
      render(h(RootLayout, null));
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    it('renders loading indicator regardless of authentication state', async () => {
      mockAuthState = { isAuthenticated: true, loading: true };
      RootLayout = await loadRootLayout();
      render(h(RootLayout, null));
      expect(screen.getByTestId('root-activity-indicator')).toBeDefined();
      expect(screen.queryByTestId('slot')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Guard 2: unauthenticated user
  // -------------------------------------------------------------------------

  describe('when loading=false and !isAuthenticated', () => {
    beforeEach(async () => {
      mockAuthState = { isAuthenticated: false, loading: false };
      mockPathname = '/';
      RootLayout = await loadRootLayout();
    });

    it('calls router.replace("/login")', () => {
      render(h(RootLayout, null));
      expect(mockRouterReplace).toHaveBeenCalledWith('/login');
    });

    it('does NOT render the Slot', () => {
      render(h(RootLayout, null));
      expect(screen.queryByTestId('slot')).toBeNull();
    });

    it('does NOT render the loading indicator', () => {
      render(h(RootLayout, null));
      expect(screen.queryByTestId('root-loading')).toBeNull();
    });

    it('redirects to /login even when on /login path', async () => {
      mockPathname = '/login';
      RootLayout = await loadRootLayout();
      render(h(RootLayout, null));
      // Unauthenticated guard fires before the auth-page guard
      expect(mockRouterReplace).toHaveBeenCalledWith('/login');
    });
  });

  // -------------------------------------------------------------------------
  // Guard 3: authenticated user on public routes
  // -------------------------------------------------------------------------

  describe('when loading=false and isAuthenticated=true on /login', () => {
    beforeEach(async () => {
      mockAuthState = { isAuthenticated: true, loading: false };
      mockPathname = '/login';
      RootLayout = await loadRootLayout();
    });

    it('calls router.replace("/")', () => {
      render(h(RootLayout, null));
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });

    it('does NOT render the Slot', () => {
      render(h(RootLayout, null));
      expect(screen.queryByTestId('slot')).toBeNull();
    });
  });

  describe('when loading=false and isAuthenticated=true on /register', () => {
    beforeEach(async () => {
      mockAuthState = { isAuthenticated: true, loading: false };
      mockPathname = '/register';
      RootLayout = await loadRootLayout();
    });

    it('calls router.replace("/")', () => {
      render(h(RootLayout, null));
      expect(mockRouterReplace).toHaveBeenCalledWith('/');
    });

    it('does NOT render the Slot', () => {
      render(h(RootLayout, null));
      expect(screen.queryByTestId('slot')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Authenticated user on protected routes
  // -------------------------------------------------------------------------

  describe('when loading=false and isAuthenticated=true on protected routes', () => {
    beforeEach(async () => {
      mockAuthState = { isAuthenticated: true, loading: false };
    });

    it('renders the Slot when pathname is "/"', async () => {
      mockPathname = '/';
      RootLayout = await loadRootLayout();
      render(h(RootLayout, null));
      expect(screen.getByTestId('slot')).toBeDefined();
    });

    it('does NOT call router.replace when pathname is "/"', async () => {
      mockPathname = '/';
      RootLayout = await loadRootLayout();
      render(h(RootLayout, null));
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    it('renders the Slot on a nested protected route', async () => {
      mockPathname = '/memos';
      RootLayout = await loadRootLayout();
      render(h(RootLayout, null));
      expect(screen.getByTestId('slot')).toBeDefined();
    });

    it('does NOT call router.replace on a nested protected route', async () => {
      mockPathname = '/memos';
      RootLayout = await loadRootLayout();
      render(h(RootLayout, null));
      expect(mockRouterReplace).not.toHaveBeenCalled();
    });

    it('does NOT render the loading indicator on a protected route', async () => {
      mockPathname = '/';
      RootLayout = await loadRootLayout();
      render(h(RootLayout, null));
      expect(screen.queryByTestId('root-loading')).toBeNull();
    });
  });
});
