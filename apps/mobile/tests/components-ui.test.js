import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock react-native ────────────────────────────────────────────────────────

vi.mock('react-native', () => ({
  View: ({ children, style, testID, accessibilityElementsHidden }) =>
    React.createElement('div', { style, 'data-testid': testID }, children),
  Text: ({ children, style, testID, numberOfLines, accessibilityElementsHidden }) =>
    React.createElement('span', { style, 'data-testid': testID, 'data-lines': numberOfLines }, children),
  TextInput: ({ value, onChangeText, placeholder, testID, editable, multiline, maxLength, style, secureTextEntry, autoCapitalize, autoComplete, keyboardType, returnKeyType, clearButtonMode, autoCorrect, accessibilityLabel }) =>
    React.createElement('input', {
      value: value ?? '',
      onChange: (e) => onChangeText && onChangeText(e.target.value),
      placeholder,
      'data-testid': testID,
      disabled: editable === false,
      type: secureTextEntry ? 'password' : 'text',
      maxLength,
      'aria-label': accessibilityLabel,
    }),
  Pressable: ({ children, onPress, disabled, testID, style, accessibilityLabel, accessibilityRole, hitSlop }) =>
    React.createElement(
      'button',
      { onClick: disabled ? undefined : onPress, disabled, 'data-testid': testID, 'aria-label': accessibilityLabel, role: accessibilityRole },
      children
    ),
  ScrollView: ({ children, horizontal, style, testID, showsHorizontalScrollIndicator, contentContainerStyle }) =>
    React.createElement('div', { style, 'data-horizontal': horizontal, 'data-testid': testID }, children),
  Image: ({ source, style, testID }) =>
    React.createElement('img', { src: source?.uri, style, 'data-testid': testID }),
  ActivityIndicator: ({ size, color, style, testID }) =>
    React.createElement('span', { 'data-testid': testID ?? 'activity-indicator', style }, 'loading'),
  Modal: ({ children, visible, transparent, animationType, onRequestClose, testID }) => {
    if (!visible) return null;
    return React.createElement(
      'div',
      { 'data-testid': testID, 'data-transparent': transparent, 'data-animation': animationType },
      children
    );
  },
  StyleSheet: {
    create: (s) => s,
    hairlineWidth: 1,
  },
  Platform: {
    OS: 'web',
    select: (obj) => obj.default ?? obj.web ?? obj.ios,
  },
}));

// ─── Mock expo-router ─────────────────────────────────────────────────────────

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSegments: () => [],
}));

// ─── Mock api-client ──────────────────────────────────────────────────────────

vi.mock('../lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

// ─── Mock use-search (used by SearchBar) ─────────────────────────────────────

vi.mock('@/hooks/use-search', () => ({
  useSearch: vi.fn(),
}));

import { api } from '../lib/api-client';
import { useSearch } from '@/hooks/use-search';
import { AttachmentPreview } from '../components/AttachmentPreview';
import { EmptyState } from '../components/EmptyState';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SearchBar } from '../components/SearchBar';
import { HighlightText } from '../components/HighlightText';
import { MemoProvider } from '../context/MemoContext';
import { AuthProvider } from '../context/AuthContext';
import { AuthForm } from '../components/AuthForm';

// ─── AttachmentPreview Tests ──────────────────────────────────────────────────

describe('AttachmentPreview', () => {
  describe('rendering with no attachments', () => {
    it('returns null when attachments is undefined', () => {
      const { container } = render(React.createElement(AttachmentPreview, {}));
      expect(container.firstChild).toBeNull();
    });

    it('returns null when attachments is an empty array', () => {
      const { container } = render(
        React.createElement(AttachmentPreview, { attachments: [] })
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('rendering image attachments', () => {
    it('renders image scroll container when there are image attachments', () => {
      const attachments = [{ type: 'image', url: 'https://example.com/img.jpg' }];
      render(React.createElement(AttachmentPreview, { attachments }));
      expect(screen.getByTestId('attachment-preview-images')).toBeTruthy();
    });

    it('renders img element with correct src for image attachment', () => {
      const attachments = [{ type: 'image', url: 'https://example.com/photo.jpg' }];
      render(React.createElement(AttachmentPreview, { attachments }));
      const img = document.querySelector('img[src="https://example.com/photo.jpg"]');
      expect(img).toBeTruthy();
    });

    it('renders multiple image thumbnails', () => {
      const attachments = [
        { type: 'image', url: 'https://example.com/img1.jpg' },
        { type: 'image', url: 'https://example.com/img2.jpg' },
      ];
      render(React.createElement(AttachmentPreview, { attachments }));
      expect(document.querySelector('img[src="https://example.com/img1.jpg"]')).toBeTruthy();
      expect(document.querySelector('img[src="https://example.com/img2.jpg"]')).toBeTruthy();
    });

    it('renders remove button for image when onRemove is provided', () => {
      const attachments = [{ type: 'image', url: 'https://example.com/img.jpg' }];
      render(
        React.createElement(AttachmentPreview, { attachments, onRemove: vi.fn() })
      );
      expect(screen.getByTestId('remove-attachment-https://example.com/img.jpg')).toBeTruthy();
    });

    it('does not render remove button for image when onRemove is not provided', () => {
      const attachments = [{ type: 'image', url: 'https://example.com/img.jpg' }];
      render(React.createElement(AttachmentPreview, { attachments }));
      expect(screen.queryByTestId('remove-attachment-https://example.com/img.jpg')).toBeNull();
    });

    it('calls onRemove with the image url when remove button is clicked', () => {
      const onRemove = vi.fn();
      const attachments = [{ type: 'image', url: 'https://example.com/to-remove.jpg' }];
      render(React.createElement(AttachmentPreview, { attachments, onRemove }));
      fireEvent.click(screen.getByTestId('remove-attachment-https://example.com/to-remove.jpg'));
      expect(onRemove).toHaveBeenCalledWith('https://example.com/to-remove.jpg');
    });
  });

  describe('rendering link attachments', () => {
    it('renders link container when there are link attachments', () => {
      const attachments = [{ type: 'link', url: 'https://example.com' }];
      render(React.createElement(AttachmentPreview, { attachments }));
      expect(screen.getByTestId('attachment-preview-links')).toBeTruthy();
    });

    it('renders the link URL text', () => {
      const attachments = [{ type: 'link', url: 'https://example.com/page' }];
      render(React.createElement(AttachmentPreview, { attachments }));
      expect(screen.getByTestId('attachment-link-https://example.com/page')).toBeTruthy();
    });

    it('renders remove button for link when onRemove is provided', () => {
      const attachments = [{ type: 'link', url: 'https://example.com' }];
      render(
        React.createElement(AttachmentPreview, { attachments, onRemove: vi.fn() })
      );
      expect(screen.getByTestId('remove-link-https://example.com')).toBeTruthy();
    });

    it('does not render remove button for link when onRemove is not provided', () => {
      const attachments = [{ type: 'link', url: 'https://example.com' }];
      render(React.createElement(AttachmentPreview, { attachments }));
      expect(screen.queryByTestId('remove-link-https://example.com')).toBeNull();
    });

    it('calls onRemove with the link url when remove button is clicked', () => {
      const onRemove = vi.fn();
      const attachments = [{ type: 'link', url: 'https://remove-me.com' }];
      render(React.createElement(AttachmentPreview, { attachments, onRemove }));
      fireEvent.click(screen.getByTestId('remove-link-https://remove-me.com'));
      expect(onRemove).toHaveBeenCalledWith('https://remove-me.com');
    });

    it('renders multiple link attachments', () => {
      const attachments = [
        { type: 'link', url: 'https://example.com' },
        { type: 'link', url: 'https://test.org' },
      ];
      render(React.createElement(AttachmentPreview, { attachments }));
      expect(screen.getByTestId('attachment-link-https://example.com')).toBeTruthy();
      expect(screen.getByTestId('attachment-link-https://test.org')).toBeTruthy();
    });
  });

  describe('mixed attachments', () => {
    it('renders both image and link sections when both types are present', () => {
      const attachments = [
        { type: 'image', url: 'https://example.com/img.jpg' },
        { type: 'link', url: 'https://example.com' },
      ];
      render(React.createElement(AttachmentPreview, { attachments }));
      expect(screen.getByTestId('attachment-preview-images')).toBeTruthy();
      expect(screen.getByTestId('attachment-preview-links')).toBeTruthy();
    });

    it('does not render image section when there are only links', () => {
      const attachments = [{ type: 'link', url: 'https://example.com' }];
      render(React.createElement(AttachmentPreview, { attachments }));
      expect(screen.queryByTestId('attachment-preview-images')).toBeNull();
    });

    it('does not render link section when there are only images', () => {
      const attachments = [{ type: 'image', url: 'https://example.com/img.jpg' }];
      render(React.createElement(AttachmentPreview, { attachments }));
      expect(screen.queryByTestId('attachment-preview-links')).toBeNull();
    });
  });
});

// ─── EmptyState Tests ─────────────────────────────────────────────────────────

describe('EmptyState', () => {
  describe('rendering', () => {
    it('renders with default testID "empty-state" when testID is not provided', () => {
      render(React.createElement(EmptyState, {}));
      expect(screen.getByTestId('empty-state')).toBeTruthy();
    });

    it('renders with provided testID', () => {
      render(React.createElement(EmptyState, { testID: 'my-empty' }));
      expect(screen.getByTestId('my-empty')).toBeTruthy();
    });

    it('renders the default message "暂无笔记" when message is not provided', () => {
      render(React.createElement(EmptyState, {}));
      expect(screen.getByTestId('empty-state-message').textContent).toBe('暂无笔记');
    });

    it('renders a custom message when provided', () => {
      render(React.createElement(EmptyState, { message: '暂无搜索结果' }));
      expect(screen.getByText('暂无搜索结果')).toBeTruthy();
    });

    it('renders hint text when hint is provided', () => {
      render(React.createElement(EmptyState, { hint: '试试其他关键词' }));
      expect(screen.getByTestId('empty-state-hint').textContent).toBe('试试其他关键词');
    });

    it('does not render hint element when hint is not provided', () => {
      render(React.createElement(EmptyState, {}));
      expect(screen.queryByTestId('empty-state-hint')).toBeNull();
    });

    it('uses custom testID as prefix for message testID', () => {
      render(React.createElement(EmptyState, { testID: 'trash-empty' }));
      expect(screen.getByTestId('trash-empty-message')).toBeTruthy();
    });

    it('uses custom testID as prefix for hint testID', () => {
      render(React.createElement(EmptyState, { testID: 'search-empty', hint: 'no results' }));
      expect(screen.getByTestId('search-empty-hint').textContent).toBe('no results');
    });
  });
});

// ─── ConfirmDialog Tests ──────────────────────────────────────────────────────

describe('ConfirmDialog', () => {
  describe('visibility', () => {
    it('does not render when visible=false', () => {
      render(React.createElement(ConfirmDialog, { visible: false }));
      expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    });

    it('renders when visible=true', () => {
      render(React.createElement(ConfirmDialog, { visible: true }));
      expect(screen.getByTestId('confirm-dialog')).toBeTruthy();
    });

    it('does not render when visible is undefined', () => {
      render(React.createElement(ConfirmDialog, {}));
      expect(screen.queryByTestId('confirm-dialog')).toBeNull();
    });
  });

  describe('content rendering', () => {
    it('renders title when provided', () => {
      render(React.createElement(ConfirmDialog, { visible: true, title: '确认删除' }));
      expect(screen.getByTestId('confirm-dialog-title').textContent).toBe('确认删除');
    });

    it('does not render title element when title is not provided', () => {
      render(React.createElement(ConfirmDialog, { visible: true }));
      expect(screen.queryByTestId('confirm-dialog-title')).toBeNull();
    });

    it('renders message when provided', () => {
      render(React.createElement(ConfirmDialog, { visible: true, message: '此操作不可撤销' }));
      expect(screen.getByTestId('confirm-dialog-message').textContent).toBe('此操作不可撤销');
    });

    it('does not render message element when message is not provided', () => {
      render(React.createElement(ConfirmDialog, { visible: true }));
      expect(screen.queryByTestId('confirm-dialog-message')).toBeNull();
    });

    it('renders cancel button with default text "取消"', () => {
      render(React.createElement(ConfirmDialog, { visible: true }));
      expect(screen.getByTestId('confirm-dialog-cancel')).toBeTruthy();
    });

    it('renders cancel button with custom cancelText', () => {
      render(React.createElement(ConfirmDialog, { visible: true, cancelText: '返回' }));
      expect(screen.getByText('返回')).toBeTruthy();
    });

    it('renders confirm button with default text "确认"', () => {
      render(React.createElement(ConfirmDialog, { visible: true }));
      expect(screen.getByTestId('confirm-dialog-confirm')).toBeTruthy();
    });

    it('renders confirm button with custom confirmText', () => {
      render(React.createElement(ConfirmDialog, { visible: true, confirmText: '删除' }));
      expect(screen.getByText('删除')).toBeTruthy();
    });
  });

  describe('custom testID', () => {
    it('uses custom testID for dialog elements', () => {
      render(React.createElement(ConfirmDialog, { visible: true, testID: 'my-dialog', title: 'Test' }));
      expect(screen.getByTestId('my-dialog')).toBeTruthy();
      expect(screen.getByTestId('my-dialog-title')).toBeTruthy();
      expect(screen.getByTestId('my-dialog-cancel')).toBeTruthy();
      expect(screen.getByTestId('my-dialog-confirm')).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('calls onCancel when cancel button is pressed', () => {
      const onCancel = vi.fn();
      render(React.createElement(ConfirmDialog, { visible: true, onCancel }));
      fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm when confirm button is pressed', () => {
      const onConfirm = vi.fn();
      render(React.createElement(ConfirmDialog, { visible: true, onConfirm }));
      fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when overlay is pressed', () => {
      const onCancel = vi.fn();
      render(React.createElement(ConfirmDialog, { visible: true, onCancel }));
      fireEvent.click(screen.getByTestId('confirm-dialog-overlay'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not throw when onCancel is not provided and cancel is pressed', () => {
      render(React.createElement(ConfirmDialog, { visible: true }));
      expect(() => fireEvent.click(screen.getByTestId('confirm-dialog-cancel'))).not.toThrow();
    });

    it('does not throw when onConfirm is not provided and confirm is pressed', () => {
      render(React.createElement(ConfirmDialog, { visible: true }));
      expect(() => fireEvent.click(screen.getByTestId('confirm-dialog-confirm'))).not.toThrow();
    });
  });

  describe('confirmDanger styling', () => {
    it('renders confirm button with danger styling when confirmDanger=true', () => {
      render(React.createElement(ConfirmDialog, { visible: true, confirmDanger: true, confirmText: '永久删除' }));
      expect(screen.getByText('永久删除')).toBeTruthy();
    });

    it('renders confirm button with primary styling when confirmDanger=false', () => {
      render(React.createElement(ConfirmDialog, { visible: true, confirmDanger: false, confirmText: '确认' }));
      expect(screen.getByText('确认')).toBeTruthy();
    });
  });
});

// ─── HighlightText Tests ──────────────────────────────────────────────────────

describe('HighlightText', () => {
  describe('rendering without keyword', () => {
    it('renders plain text when keyword is undefined', () => {
      render(React.createElement(HighlightText, { text: 'Hello world', testID: 'ht1' }));
      expect(screen.getByTestId('ht1').textContent).toBe('Hello world');
    });

    it('renders plain text when keyword is empty string', () => {
      render(React.createElement(HighlightText, { text: 'Hello world', keyword: '', testID: 'ht2' }));
      expect(screen.getByTestId('ht2').textContent).toBe('Hello world');
    });

    it('renders plain text when keyword is only whitespace', () => {
      render(React.createElement(HighlightText, { text: 'Hello world', keyword: '   ', testID: 'ht3' }));
      expect(screen.getByTestId('ht3').textContent).toBe('Hello world');
    });

    it('renders empty span when text is undefined', () => {
      render(React.createElement(HighlightText, { testID: 'ht4' }));
      expect(screen.getByTestId('ht4')).toBeTruthy();
    });

    it('renders text when keyword is not found in text', () => {
      render(React.createElement(HighlightText, { text: 'Hello world', keyword: 'xyz', testID: 'ht5' }));
      expect(screen.getByTestId('ht5').textContent).toBe('Hello world');
    });
  });

  describe('rendering with keyword', () => {
    it('renders highlight span for matching keyword', () => {
      render(React.createElement(HighlightText, { text: 'Hello world', keyword: 'world', testID: 'ht6' }));
      expect(screen.getByTestId('ht6-highlight-1')).toBeTruthy();
      expect(screen.getByTestId('ht6-highlight-1').textContent).toBe('world');
    });

    it('renders highlighted text case-insensitively', () => {
      render(React.createElement(HighlightText, { text: 'Hello World', keyword: 'world', testID: 'ht7' }));
      expect(screen.getByTestId('ht7-highlight-1')).toBeTruthy();
    });

    it('highlights all occurrences of the keyword', () => {
      render(
        React.createElement(HighlightText, { text: 'foo bar foo baz foo', keyword: 'foo', testID: 'ht8' })
      );
      expect(screen.getByTestId('ht8-highlight-0')).toBeTruthy();
      expect(screen.getByTestId('ht8-highlight-2')).toBeTruthy();
      expect(screen.getByTestId('ht8-highlight-4')).toBeTruthy();
    });

    it('handles special regex characters in keyword', () => {
      render(
        React.createElement(HighlightText, { text: 'price is $10.00', keyword: '$10.00', testID: 'ht9' })
      );
      expect(screen.getByTestId('ht9-highlight-1')).toBeTruthy();
    });

    it('renders Chinese character keyword highlighting', () => {
      render(
        React.createElement(HighlightText, { text: '今天学习了 React', keyword: 'React', testID: 'ht10' })
      );
      expect(screen.getByTestId('ht10-highlight-1')).toBeTruthy();
    });

    it('does not add testID to highlights when testID is not provided', () => {
      render(React.createElement(HighlightText, { text: 'Hello world', keyword: 'Hello' }));
      expect(screen.queryByTestId(/highlight/)).toBeNull();
    });
  });
});

// ─── SearchBar Tests ──────────────────────────────────────────────────────────

describe('SearchBar', () => {
  function defaultUseSearch() {
    return {
      query: '',
      isSearching: false,
      setQuery: vi.fn(),
      clearSearch: vi.fn(),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    useSearch.mockReturnValue(defaultUseSearch());
  });

  describe('rendering', () => {
    it('renders the search bar container with default testID "search-bar"', () => {
      render(React.createElement(SearchBar));
      expect(screen.getByTestId('search-bar')).toBeTruthy();
    });

    it('renders the search bar with a custom testID', () => {
      render(React.createElement(SearchBar, { testID: 'my-search' }));
      expect(screen.getByTestId('my-search')).toBeTruthy();
    });

    it('renders the text input with default testID "search-bar-input"', () => {
      render(React.createElement(SearchBar));
      expect(screen.getByTestId('search-bar-input')).toBeTruthy();
    });

    it('renders input with correct testID when testID is provided', () => {
      render(React.createElement(SearchBar, { testID: 'my-search' }));
      expect(screen.getByTestId('my-search-input')).toBeTruthy();
    });

    it('renders placeholder text', () => {
      render(React.createElement(SearchBar));
      const input = screen.getByTestId('search-bar-input');
      expect(input.placeholder).toBe('搜索笔记...');
    });

    it('renders custom placeholder when provided', () => {
      render(React.createElement(SearchBar, { placeholder: '自定义搜索' }));
      const input = screen.getByTestId('search-bar-input');
      expect(input.placeholder).toBe('自定义搜索');
    });

    it('does not render loading indicator when isSearching=false', () => {
      render(React.createElement(SearchBar));
      expect(screen.queryByTestId('search-bar-loading')).toBeNull();
    });

    it('renders loading indicator when isSearching=true', () => {
      useSearch.mockReturnValue({ ...defaultUseSearch(), isSearching: true });
      render(React.createElement(SearchBar));
      expect(screen.getByTestId('search-bar-loading')).toBeTruthy();
    });

    it('does not render clear button when query is empty', () => {
      render(React.createElement(SearchBar));
      expect(screen.queryByTestId('search-bar-clear')).toBeNull();
    });

    it('renders clear button when query is not empty and not searching', () => {
      useSearch.mockReturnValue({ ...defaultUseSearch(), query: 'hello', isSearching: false });
      render(React.createElement(SearchBar));
      expect(screen.getByTestId('search-bar-clear')).toBeTruthy();
    });

    it('does not render clear button when isSearching=true even if query has text', () => {
      useSearch.mockReturnValue({ ...defaultUseSearch(), query: 'hello', isSearching: true });
      render(React.createElement(SearchBar));
      expect(screen.queryByTestId('search-bar-clear')).toBeNull();
    });
  });

  describe('interactions', () => {
    it('calls setQuery when input value changes', () => {
      const setQuery = vi.fn();
      useSearch.mockReturnValue({ ...defaultUseSearch(), setQuery });
      render(React.createElement(SearchBar));
      fireEvent.change(screen.getByTestId('search-bar-input'), { target: { value: 'new value' } });
      expect(setQuery).toHaveBeenCalledWith('new value');
    });

    it('calls clearSearch when clear button is pressed', () => {
      const clearSearch = vi.fn();
      useSearch.mockReturnValue({ ...defaultUseSearch(), query: 'text', clearSearch });
      render(React.createElement(SearchBar));
      fireEvent.click(screen.getByTestId('search-bar-clear'));
      expect(clearSearch).toHaveBeenCalledTimes(1);
    });
  });
});

// ─── AuthForm Tests ───────────────────────────────────────────────────────────

describe('AuthForm', () => {
  function renderLoginForm(props = {}) {
    return render(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(AuthForm, { mode: 'login', ...props })
      )
    );
  }

  function renderRegisterForm(props = {}) {
    return render(
      React.createElement(
        AuthProvider,
        null,
        React.createElement(AuthForm, { mode: 'register', ...props })
      )
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('login mode rendering', () => {
    it('renders email input', () => {
      renderLoginForm();
      expect(screen.getByPlaceholderText('请输入邮箱')).toBeTruthy();
    });

    it('renders password input', () => {
      renderLoginForm();
      expect(screen.getByPlaceholderText('请输入密码（至少 8 位）')).toBeTruthy();
    });

    it('renders "登录" submit button', () => {
      renderLoginForm();
      expect(screen.getByText('登录')).toBeTruthy();
    });

    it('does not render nickname field in login mode', () => {
      renderLoginForm();
      expect(screen.queryByPlaceholderText('请输入昵称')).toBeNull();
    });
  });

  describe('register mode rendering', () => {
    it('renders email input in register mode', () => {
      renderRegisterForm();
      expect(screen.getByPlaceholderText('请输入邮箱')).toBeTruthy();
    });

    it('renders nickname input in register mode', () => {
      renderRegisterForm();
      expect(screen.getByPlaceholderText('请输入昵称')).toBeTruthy();
    });

    it('renders password input in register mode', () => {
      renderRegisterForm();
      expect(screen.getByPlaceholderText('请输入密码（至少 8 位）')).toBeTruthy();
    });

    it('renders "注册" submit button in register mode', () => {
      renderRegisterForm();
      expect(screen.getByText('注册')).toBeTruthy();
    });
  });

  describe('validation – login mode', () => {
    it('shows error when email is empty on submit', async () => {
      renderLoginForm();
      fireEvent.click(screen.getByText('登录'));
      expect(screen.getByText('请输入邮箱')).toBeTruthy();
    });

    it('shows error when password is empty on submit', async () => {
      renderLoginForm();
      fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), { target: { value: 'a@b.com' } });
      fireEvent.click(screen.getByText('登录'));
      expect(screen.getByText('请输入密码')).toBeTruthy();
    });

    it('shows error when password is less than 8 characters', async () => {
      renderLoginForm();
      fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('请输入密码（至少 8 位）'), { target: { value: 'short' } });
      fireEvent.click(screen.getByText('登录'));
      expect(screen.getByText('密码长度不能少于 8 位')).toBeTruthy();
    });
  });

  describe('validation – register mode', () => {
    it('shows error when email is empty on submit in register mode', async () => {
      renderRegisterForm();
      fireEvent.click(screen.getByText('注册'));
      expect(screen.getByText('请输入邮箱')).toBeTruthy();
    });

    it('shows error when nickname is empty in register mode', async () => {
      renderRegisterForm();
      fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('请输入密码（至少 8 位）'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByText('注册'));
      expect(screen.getByText('请输入昵称')).toBeTruthy();
    });

    it('shows error when nickname exceeds 50 characters', async () => {
      renderRegisterForm();
      fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('请输入密码（至少 8 位）'), { target: { value: 'password123' } });
      fireEvent.change(screen.getByPlaceholderText('请输入昵称'), { target: { value: 'n'.repeat(51) } });
      fireEvent.click(screen.getByText('注册'));
      expect(screen.getByText('昵称长度不能超过 50 个字符')).toBeTruthy();
    });
  });

  describe('successful submission', () => {
    it('calls login api on valid login form submit', async () => {
      const user = { id: '1', email: 'a@b.com', nickname: 'Alice' };
      api.post.mockResolvedValue(user);

      renderLoginForm();
      fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('请输入密码（至少 8 位）'), { target: { value: 'password123' } });

      await act(async () => {
        fireEvent.click(screen.getByText('登录'));
      });

      expect(api.post).toHaveBeenCalledWith('/api/auth/login', {
        email: 'a@b.com',
        password: 'password123',
      });
    });

    it('calls onSuccess callback after successful login', async () => {
      const user = { id: '1', email: 'a@b.com', nickname: 'Alice' };
      api.post.mockResolvedValue(user);
      const onSuccess = vi.fn();

      renderLoginForm({ onSuccess });
      fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('请输入密码（至少 8 位）'), { target: { value: 'password123' } });

      await act(async () => {
        fireEvent.click(screen.getByText('登录'));
      });

      expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    it('calls register api on valid register form submit', async () => {
      const user = { id: '2', email: 'new@b.com', nickname: 'NewUser' };
      api.post.mockResolvedValue(user);

      renderRegisterForm();
      fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), { target: { value: 'new@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('请输入昵称'), { target: { value: 'NewUser' } });
      fireEvent.change(screen.getByPlaceholderText('请输入密码（至少 8 位）'), { target: { value: 'securepassword' } });

      await act(async () => {
        fireEvent.click(screen.getByText('注册'));
      });

      expect(api.post).toHaveBeenCalledWith('/api/auth/register', {
        email: 'new@b.com',
        password: 'securepassword',
        nickname: 'NewUser',
      });
    });
  });

  describe('failed submission', () => {
    it('shows error message when login api fails', async () => {
      api.post.mockRejectedValue(new Error('Invalid credentials'));
      renderLoginForm();
      fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('请输入密码（至少 8 位）'), { target: { value: 'wrongpass' } });

      await act(async () => {
        fireEvent.click(screen.getByText('登录'));
      });

      expect(screen.getByText('Invalid credentials')).toBeTruthy();
    });

    it('shows fallback error when login api error has no message', async () => {
      api.post.mockRejectedValue({ message: undefined });
      renderLoginForm();
      fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('请输入密码（至少 8 位）'), { target: { value: 'password123' } });

      await act(async () => {
        fireEvent.click(screen.getByText('登录'));
      });

      expect(screen.getByText('登录失败，请检查邮箱和密码')).toBeTruthy();
    });

    it('shows fallback error when register api error has no message', async () => {
      api.post.mockRejectedValue({ message: undefined });
      renderRegisterForm();
      fireEvent.change(screen.getByPlaceholderText('请输入邮箱'), { target: { value: 'a@b.com' } });
      fireEvent.change(screen.getByPlaceholderText('请输入昵称'), { target: { value: 'User' } });
      fireEvent.change(screen.getByPlaceholderText('请输入密码（至少 8 位）'), { target: { value: 'password123' } });

      await act(async () => {
        fireEvent.click(screen.getByText('注册'));
      });

      expect(screen.getByText('注册失败，请重试')).toBeTruthy();
    });
  });
});
