import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock expo-router
vi.mock('expo-router', () => ({
  useRouter: vi.fn(() => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
  })),
  useSegments: vi.fn(() => []),
  Link: ({ children }) => children,
  router: {
    replace: vi.fn(),
    push: vi.fn(),
  },
}));

// Mock @expo/vector-icons
vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, size, color }) => null,
}));
