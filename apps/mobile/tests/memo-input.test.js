import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';

// ─── Mock react-native ────────────────────────────────────────────────────────

vi.mock('react-native', () => ({
  View: ({ children, style, testID }) =>
    React.createElement('div', { style, 'data-testid': testID }, children),
  Text: ({ children, style, numberOfLines }) =>
    React.createElement('span', { style, 'data-lines': numberOfLines }, children),
  TextInput: ({ value, onChangeText, placeholder, testID, editable, multiline, maxLength }) =>
    React.createElement('textarea', {
      value: value ?? '',
      onChange: (e) => onChangeText && onChangeText(e.target.value),
      placeholder,
      'data-testid': testID,
      disabled: editable === false,
      rows: multiline ? 4 : 1,
      maxLength,
    }),
  Pressable: ({ children, onPress, disabled, testID, style }) =>
    React.createElement(
      'button',
      { onClick: disabled ? undefined : onPress, disabled, 'data-testid': testID, style },
      children
    ),
  ScrollView: ({ children, horizontal, style }) =>
    React.createElement('div', { style, 'data-horizontal': horizontal }, children),
  Image: ({ source, style }) =>
    React.createElement('img', { src: source?.uri, style }),
  ActivityIndicator: () => React.createElement('span', null, 'loading'),
  Alert: { alert: vi.fn() },
  StyleSheet: { create: (s) => s },
  Platform: { OS: 'web' },
}));

// ─── Mock expo-image-picker ───────────────────────────────────────────────────

vi.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
  MediaTypeOptions: { Images: 'Images' },
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

import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api-client';
import { MemoProvider } from '../context/MemoContext';
import { MemoInput } from '../components/MemoInput';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderMemoInput(props = {}) {
  return render(
    React.createElement(
      MemoProvider,
      null,
      React.createElement(MemoInput, props)
    )
  );
}

function getTextInput() {
  return screen.getByTestId('memo-text-input');
}

function getSubmitButton() {
  return screen.getByTestId('submit-memo-btn');
}

function typeContent(content) {
  fireEvent.change(getTextInput(), { target: { value: content } });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MemoInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ImagePicker.requestMediaLibraryPermissionsAsync.mockResolvedValue({ status: 'granted' });
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });
  });

  // ─── Rendering ─────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the text input with placeholder', () => {
      renderMemoInput();
      const input = getTextInput();
      expect(input).toBeTruthy();
      expect(input.placeholder).toBe('现在有什么想法...');
    });

    it('renders the submit button', () => {
      renderMemoInput();
      expect(getSubmitButton()).toBeTruthy();
    });

    it('renders the pick-image button', () => {
      renderMemoInput();
      expect(screen.getByTestId('pick-image-btn')).toBeTruthy();
    });

    it('submit button is disabled when content is empty', () => {
      renderMemoInput();
      expect(getSubmitButton().disabled).toBe(true);
    });

    it('submit button is enabled when content has text', () => {
      renderMemoInput();
      typeContent('some content');
      expect(getSubmitButton().disabled).toBe(false);
    });

    it('submit button is disabled when content is only whitespace', () => {
      renderMemoInput();
      typeContent('   ');
      expect(getSubmitButton().disabled).toBe(true);
    });

    it('does not show error box initially', () => {
      renderMemoInput();
      expect(screen.queryByText(/请输入笔记内容/)).toBeNull();
    });

    it('does not show tag badges when no tags are in content', () => {
      renderMemoInput();
      typeContent('no tags here');
      expect(screen.queryByText(/#工作/)).toBeNull();
    });
  });

  // ─── Input Validation ───────────────────────────────────────────────────────

  describe('input validation', () => {
    it('does not call api when content is empty (button is disabled)', async () => {
      renderMemoInput();
      expect(getSubmitButton().disabled).toBe(true);
      await act(async () => {
        fireEvent.click(getSubmitButton());
      });
      expect(api.post).not.toHaveBeenCalled();
    });

    it('does not call api when content is whitespace-only (button is disabled)', async () => {
      renderMemoInput();
      typeContent('   ');
      expect(getSubmitButton().disabled).toBe(true);
      await act(async () => {
        fireEvent.click(getSubmitButton());
      });
      expect(api.post).not.toHaveBeenCalled();
    });

    it('shows error when content exceeds 10000 characters', async () => {
      api.post.mockResolvedValue({ data: { id: '1', content: 'x'.repeat(10001) }, message: 'ok' });
      renderMemoInput();

      // We need to bypass the maxLength restriction in the mock textarea
      // by directly testing via handleSubmit with a long string.
      // The component reads content state, so we fire a change event with the long string.
      const longContent = 'a'.repeat(10001);
      typeContent(longContent);

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByText('内容长度不能超过 10000 字符')).toBeTruthy();
      });
      expect(api.post).not.toHaveBeenCalled();
    });

    it('accepts content at exactly 10000 characters', async () => {
      const exactContent = 'b'.repeat(10000);
      api.post.mockResolvedValue({ data: { id: '2', content: exactContent }, message: 'ok' });
      renderMemoInput();
      typeContent(exactContent);

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/memos', expect.objectContaining({
          content: exactContent,
        }));
      });
    });

    it('shows error when tags exceed 10', async () => {
      // Build content with 11 unique tags
      const manyTags = Array.from({ length: 11 }, (_, i) => `#tag${i}`).join(' ');
      renderMemoInput();
      typeContent(manyTags);

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByText('标签数量不能超过 10 个')).toBeTruthy();
      });
      expect(api.post).not.toHaveBeenCalled();
    });

    it('accepts exactly 10 tags without error', async () => {
      const tenTags = Array.from({ length: 10 }, (_, i) => `#tag${i}`).join(' ') + ' content';
      api.post.mockResolvedValue({ data: { id: '3', content: tenTags }, message: 'ok' });
      renderMemoInput();
      typeContent(tenTags);

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
      });
      expect(screen.queryByText(/标签数量不能超过/)).toBeNull();
    });

    it('clears a prior error on successful submit', async () => {
      // First trigger an error by submitting over 10000 chars (button enabled, error shown)
      api.post.mockResolvedValue({ data: { id: '4', content: 'valid' }, message: 'ok' });
      renderMemoInput();
      typeContent('a'.repeat(10001));

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByText('内容长度不能超过 10000 字符')).toBeTruthy();
      });

      // Now type valid content and submit successfully
      typeContent('valid content');
      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.queryByText('内容长度不能超过 10000 字符')).toBeNull();
      });
    });
  });

  // ─── Tag Parsing ────────────────────────────────────────────────────────────

  describe('tag parsing (extractTags)', () => {
    it('displays a tag badge when content contains #tag', () => {
      renderMemoInput();
      typeContent('Today I worked on #project');
      expect(screen.getByText('#project')).toBeTruthy();
    });

    it('displays multiple tag badges for multiple tags', () => {
      renderMemoInput();
      typeContent('#工作 #生活 some text');
      expect(screen.getByText('#工作')).toBeTruthy();
      expect(screen.getByText('#生活')).toBeTruthy();
    });

    it('deduplicates repeated tags', () => {
      renderMemoInput();
      typeContent('#work #work #work');
      const badges = screen.getAllByText('#work');
      expect(badges).toHaveLength(1);
    });

    it('parses Chinese character tags', () => {
      renderMemoInput();
      typeContent('记录一下 #学习笔记 today');
      expect(screen.getByText('#学习笔记')).toBeTruthy();
    });

    it('parses tags containing digits and underscores', () => {
      renderMemoInput();
      typeContent('#tag_123 content');
      expect(screen.getByText('#tag_123')).toBeTruthy();
    });

    it('does not display tag badges when no # tags in content', () => {
      renderMemoInput();
      typeContent('just plain text without any hashtags');
      // No tag scroll should appear - check none of the tag container text matches
      expect(screen.queryByText(/^#/)).toBeNull();
    });

    it('ignores tags longer than 20 characters', () => {
      renderMemoInput();
      // regex captures 1-20 chars so a 25 char tag would only match first 20 chars
      typeContent('#' + 'a'.repeat(25));
      const badge = screen.queryByText('#' + 'a'.repeat(25));
      // It should NOT display the full 25-char tag
      expect(badge).toBeNull();
      // But it might display first 20 chars as a partial match
      const partialBadge = screen.queryByText('#' + 'a'.repeat(20));
      expect(partialBadge).toBeTruthy();
    });

    it('sends extracted tags as part of the attachments-free content', async () => {
      api.post.mockResolvedValue({ data: { id: '5', content: 'memo with #tag1' }, message: 'ok' });
      renderMemoInput();
      typeContent('memo with #tag1');

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/memos', {
          content: 'memo with #tag1',
          attachments: [],
        });
      });
    });
  });

  // ─── Link Detection ─────────────────────────────────────────────────────────

  describe('link detection (extractLinks)', () => {
    it('displays a link badge when content contains a URL', () => {
      renderMemoInput();
      typeContent('Check out https://example.com for details');
      expect(screen.getByText('https://example.com')).toBeTruthy();
    });

    it('displays multiple link badges for multiple URLs', () => {
      renderMemoInput();
      typeContent('See https://example.com and http://test.org');
      expect(screen.getByText('https://example.com')).toBeTruthy();
      expect(screen.getByText('http://test.org')).toBeTruthy();
    });

    it('deduplicates repeated URLs', () => {
      renderMemoInput();
      typeContent('https://example.com https://example.com');
      const badges = screen.getAllByText('https://example.com');
      expect(badges).toHaveLength(1);
    });

    it('does not show link badges when no URLs in content', () => {
      renderMemoInput();
      typeContent('plain text without any URL');
      // Check that link badge container is not rendered
      expect(screen.queryByText(/^https?:\/\//)).toBeNull();
    });

    it('sends links as attachments of type link on submit', async () => {
      api.post.mockResolvedValue({ data: { id: '6', content: 'link memo' }, message: 'ok' });
      renderMemoInput();
      typeContent('Visit https://example.com');

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/memos', {
          content: 'Visit https://example.com',
          attachments: [{ type: 'link', url: 'https://example.com' }],
        });
      });
    });

    it('sends both image and link attachments when both are present', async () => {
      ImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file://img.jpg', fileSize: 1024 }],
      });
      api.post.mockResolvedValue({ data: { id: '7', content: 'mixed memo' }, message: 'ok' });
      renderMemoInput();
      typeContent('See https://example.com');

      await act(async () => {
        fireEvent.click(screen.getByTestId('pick-image-btn'));
      });

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        const callArgs = api.post.mock.calls[0][1];
        const attachmentTypes = callArgs.attachments.map((a) => a.type);
        expect(attachmentTypes).toContain('image');
        expect(attachmentTypes).toContain('link');
      });
    });
  });

  // ─── Attachment Handling ────────────────────────────────────────────────────

  describe('attachment handling', () => {
    describe('picking images', () => {
      it('adds an image thumbnail when user picks a valid image', async () => {
        ImagePicker.launchImageLibraryAsync.mockResolvedValue({
          canceled: false,
          assets: [{ uri: 'file://photo.jpg', fileSize: 1000 }],
        });
        renderMemoInput();

        await act(async () => {
          fireEvent.click(screen.getByTestId('pick-image-btn'));
        });

        await waitFor(() => {
          const img = document.querySelector('img[src="file://photo.jpg"]');
          expect(img).toBeTruthy();
        });
      });

      it('requests media library permissions on non-web platforms', async () => {
        // The component only requests permissions when Platform.OS !== 'web'.
        // Our mock sets Platform.OS = 'web', so it should NOT call requestMediaLibraryPermissionsAsync.
        renderMemoInput();

        await act(async () => {
          fireEvent.click(screen.getByTestId('pick-image-btn'));
        });

        expect(ImagePicker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
      });

      it('does not add image when picker is canceled', async () => {
        ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: true });
        renderMemoInput();

        await act(async () => {
          fireEvent.click(screen.getByTestId('pick-image-btn'));
        });

        await waitFor(() => {
          expect(document.querySelector('img')).toBeNull();
        });
      });

      it('shows error and does not add image when file size exceeds 5MB', async () => {
        const OVER_5MB = 5 * 1024 * 1024 + 1;
        ImagePicker.launchImageLibraryAsync.mockResolvedValue({
          canceled: false,
          assets: [{ uri: 'file://big.jpg', fileSize: OVER_5MB }],
        });
        renderMemoInput();

        await act(async () => {
          fireEvent.click(screen.getByTestId('pick-image-btn'));
        });

        await waitFor(() => {
          expect(screen.getByText('图片大小不得超过 5MB')).toBeTruthy();
          expect(document.querySelector('img')).toBeNull();
        });
      });

      it('accepts image exactly at 5MB boundary', async () => {
        const EXACTLY_5MB = 5 * 1024 * 1024;
        ImagePicker.launchImageLibraryAsync.mockResolvedValue({
          canceled: false,
          assets: [{ uri: 'file://exact.jpg', fileSize: EXACTLY_5MB }],
        });
        renderMemoInput();

        await act(async () => {
          fireEvent.click(screen.getByTestId('pick-image-btn'));
        });

        await waitFor(() => {
          const img = document.querySelector('img[src="file://exact.jpg"]');
          expect(img).toBeTruthy();
        });
      });

      it('accepts image when fileSize is not provided (no size check)', async () => {
        ImagePicker.launchImageLibraryAsync.mockResolvedValue({
          canceled: false,
          assets: [{ uri: 'file://nosize.jpg' }],
        });
        renderMemoInput();

        await act(async () => {
          fireEvent.click(screen.getByTestId('pick-image-btn'));
        });

        await waitFor(() => {
          const img = document.querySelector('img[src="file://nosize.jpg"]');
          expect(img).toBeTruthy();
        });
      });

      it('can add multiple images sequentially', async () => {
        ImagePicker.launchImageLibraryAsync
          .mockResolvedValueOnce({
            canceled: false,
            assets: [{ uri: 'file://img1.jpg', fileSize: 500 }],
          })
          .mockResolvedValueOnce({
            canceled: false,
            assets: [{ uri: 'file://img2.jpg', fileSize: 600 }],
          });
        renderMemoInput();

        await act(async () => {
          fireEvent.click(screen.getByTestId('pick-image-btn'));
        });
        await act(async () => {
          fireEvent.click(screen.getByTestId('pick-image-btn'));
        });

        await waitFor(() => {
          expect(document.querySelector('img[src="file://img1.jpg"]')).toBeTruthy();
          expect(document.querySelector('img[src="file://img2.jpg"]')).toBeTruthy();
        });
      });
    });

    describe('removing images', () => {
      it('removes an image when the remove button is clicked', async () => {
        const uri = 'file://remove-me.jpg';
        ImagePicker.launchImageLibraryAsync.mockResolvedValue({
          canceled: false,
          assets: [{ uri, fileSize: 500 }],
        });
        renderMemoInput();

        await act(async () => {
          fireEvent.click(screen.getByTestId('pick-image-btn'));
        });

        await waitFor(() => {
          expect(document.querySelector(`img[src="${uri}"]`)).toBeTruthy();
        });

        await act(async () => {
          fireEvent.click(screen.getByTestId(`remove-image-${uri}`));
        });

        await waitFor(() => {
          expect(document.querySelector(`img[src="${uri}"]`)).toBeNull();
        });
      });

      it('only removes the clicked image when multiple images are present', async () => {
        const uri1 = 'file://keep.jpg';
        const uri2 = 'file://remove.jpg';
        ImagePicker.launchImageLibraryAsync
          .mockResolvedValueOnce({ canceled: false, assets: [{ uri: uri1, fileSize: 100 }] })
          .mockResolvedValueOnce({ canceled: false, assets: [{ uri: uri2, fileSize: 200 }] });
        renderMemoInput();

        await act(async () => { fireEvent.click(screen.getByTestId('pick-image-btn')); });
        await act(async () => { fireEvent.click(screen.getByTestId('pick-image-btn')); });

        await waitFor(() => {
          expect(document.querySelector(`img[src="${uri1}"]`)).toBeTruthy();
          expect(document.querySelector(`img[src="${uri2}"]`)).toBeTruthy();
        });

        await act(async () => {
          fireEvent.click(screen.getByTestId(`remove-image-${uri2}`));
        });

        await waitFor(() => {
          expect(document.querySelector(`img[src="${uri1}"]`)).toBeTruthy();
          expect(document.querySelector(`img[src="${uri2}"]`)).toBeNull();
        });
      });
    });

    describe('image attachments on submit', () => {
      it('sends picked images as attachments of type image', async () => {
        ImagePicker.launchImageLibraryAsync.mockResolvedValue({
          canceled: false,
          assets: [{ uri: 'file://myphoto.jpg', fileSize: 1024 }],
        });
        api.post.mockResolvedValue({ data: { id: '8', content: 'with image' }, message: 'ok' });
        renderMemoInput();
        typeContent('with image');

        await act(async () => {
          fireEvent.click(screen.getByTestId('pick-image-btn'));
        });

        await act(async () => {
          fireEvent.click(getSubmitButton());
        });

        await waitFor(() => {
          expect(api.post).toHaveBeenCalledWith('/api/memos', {
            content: 'with image',
            attachments: [{ type: 'image', url: 'file://myphoto.jpg' }],
          });
        });
      });

      it('sends no image attachments when all images are removed before submit', async () => {
        const uri = 'file://removed.jpg';
        ImagePicker.launchImageLibraryAsync.mockResolvedValue({
          canceled: false,
          assets: [{ uri, fileSize: 500 }],
        });
        api.post.mockResolvedValue({ data: { id: '9', content: 'no images' }, message: 'ok' });
        renderMemoInput();
        typeContent('no images');

        await act(async () => {
          fireEvent.click(screen.getByTestId('pick-image-btn'));
        });

        await waitFor(() => {
          expect(document.querySelector(`img[src="${uri}"]`)).toBeTruthy();
        });

        await act(async () => {
          fireEvent.click(screen.getByTestId(`remove-image-${uri}`));
        });

        await act(async () => {
          fireEvent.click(getSubmitButton());
        });

        await waitFor(() => {
          expect(api.post).toHaveBeenCalledWith('/api/memos', {
            content: 'no images',
            attachments: [],
          });
        });
      });
    });
  });

  // ─── Submit Flow ────────────────────────────────────────────────────────────

  describe('submit flow', () => {
    it('calls createMemo with trimmed content on submit', async () => {
      api.post.mockResolvedValue({ data: { id: '10', content: 'trimmed' }, message: 'ok' });
      renderMemoInput();
      typeContent('  trimmed  ');

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/memos', {
          content: 'trimmed',
          attachments: [],
        });
      });
    });

    it('resets content and images after successful submit', async () => {
      const uri = 'file://reset.jpg';
      ImagePicker.launchImageLibraryAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri, fileSize: 500 }],
      });
      api.post.mockResolvedValue({ data: { id: '11', content: 'will reset' }, message: 'ok' });
      renderMemoInput();
      typeContent('will reset');

      await act(async () => {
        fireEvent.click(screen.getByTestId('pick-image-btn'));
      });

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getTextInput().value).toBe('');
        expect(document.querySelector(`img[src="${uri}"]`)).toBeNull();
      });
    });

    it('calls onSuccess callback after successful submit', async () => {
      api.post.mockResolvedValue({ data: { id: '12', content: 'callback test' }, message: 'ok' });
      const onSuccess = vi.fn();
      renderMemoInput({ onSuccess });
      typeContent('callback test');

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledTimes(1);
      });
    });

    it('does not call onSuccess when onSuccess is not provided', async () => {
      api.post.mockResolvedValue({ data: { id: '13', content: 'no callback' }, message: 'ok' });
      renderMemoInput();
      typeContent('no callback');

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(api.post).toHaveBeenCalled();
      });
      // Should not throw even without onSuccess prop
    });

    it('shows error message when createMemo fails', async () => {
      api.post.mockRejectedValue(new Error('Server error'));
      renderMemoInput();
      typeContent('will fail');

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeTruthy();
      });
    });

    it('shows generic error when createMemo throws an object without a message property', async () => {
      // Throw an object without a .message property so err.message is undefined,
      // and the ?? fallback '创建笔记失败，请重试' is used.
      api.post.mockRejectedValue({ message: undefined });
      renderMemoInput();
      typeContent('empty error');

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByText('创建笔记失败，请重试')).toBeTruthy();
      });
    });

    it('preserves content after failed submit', async () => {
      api.post.mockRejectedValue(new Error('Network error'));
      renderMemoInput();
      typeContent('important content');

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getTextInput().value).toBe('important content');
      });
    });

    it('disables text input while submitting', async () => {
      let resolvePost;
      api.post.mockReturnValue(new Promise((res) => { resolvePost = res; }));
      renderMemoInput();
      typeContent('submitting content');

      act(() => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getTextInput().disabled).toBe(true);
      });

      await act(async () => {
        resolvePost({ data: { id: '14', content: 'submitting content' }, message: 'ok' });
      });

      await waitFor(() => {
        expect(getTextInput().disabled).toBe(false);
      });
    });

    it('disables submit button while submitting', async () => {
      let resolvePost;
      api.post.mockReturnValue(new Promise((res) => { resolvePost = res; }));
      renderMemoInput();
      typeContent('busy submitting');

      act(() => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(getSubmitButton().disabled).toBe(true);
      });

      await act(async () => {
        resolvePost({ data: { id: '15', content: 'busy submitting' }, message: 'ok' });
      });
    });

    it('clears error on successful submit after a prior error', async () => {
      api.post
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue({ data: { id: '16', content: 'success' }, message: 'ok' });
      renderMemoInput();
      typeContent('retry me');

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.getByText('First failure')).toBeTruthy();
      });

      typeContent('retry me');
      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(screen.queryByText('First failure')).toBeNull();
      });
    });
  });

  // ─── Character Counter ──────────────────────────────────────────────────────

  describe('character counter', () => {
    it('does not show character counter when content is short', () => {
      renderMemoInput();
      typeContent('short');
      // Counter only shows when content.length > 9800 (MAX_CONTENT_LENGTH - 200)
      expect(screen.queryByText(/^\d+$/)).toBeNull();
    });

    it('shows character counter when content is near the limit', () => {
      renderMemoInput();
      // Type 9801 characters to trigger the counter (> 10000 - 200 = 9800)
      const nearLimit = 'a'.repeat(9801);
      typeContent(nearLimit);
      // charsLeft = 10000 - 9801 = 199
      expect(screen.getByText('199')).toBeTruthy();
    });

    it('shows negative character count when over limit', () => {
      renderMemoInput();
      const overLimit = 'a'.repeat(10001);
      typeContent(overLimit);
      // charsLeft = 10000 - 10001 = -1
      expect(screen.getByText('-1')).toBeTruthy();
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles content with both tags and links correctly', async () => {
      api.post.mockResolvedValue({ data: { id: '17', content: 'mixed' }, message: 'ok' });
      renderMemoInput();
      typeContent('#work Check https://example.com for details');

      expect(screen.getByText('#work')).toBeTruthy();
      expect(screen.getByText('https://example.com')).toBeTruthy();

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/memos', {
          content: '#work Check https://example.com for details',
          attachments: [{ type: 'link', url: 'https://example.com' }],
        });
      });
    });

    it('passes an empty attachments array when content has no links or images', async () => {
      api.post.mockResolvedValue({ data: { id: '18', content: 'plain memo' }, message: 'ok' });
      renderMemoInput();
      typeContent('plain memo');

      await act(async () => {
        fireEvent.click(getSubmitButton());
      });

      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith('/api/memos', {
          content: 'plain memo',
          attachments: [],
        });
      });
    });

    it('image error clears when a new valid image is picked after an oversized image', async () => {
      const OVER_5MB = 5 * 1024 * 1024 + 1;
      ImagePicker.launchImageLibraryAsync
        .mockResolvedValueOnce({
          canceled: false,
          assets: [{ uri: 'file://big.jpg', fileSize: OVER_5MB }],
        })
        .mockResolvedValueOnce({
          canceled: false,
          assets: [{ uri: 'file://ok.jpg', fileSize: 100 }],
        });
      renderMemoInput();

      await act(async () => {
        fireEvent.click(screen.getByTestId('pick-image-btn'));
      });

      await waitFor(() => {
        expect(screen.getByText('图片大小不得超过 5MB')).toBeTruthy();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('pick-image-btn'));
      });

      await waitFor(() => {
        expect(screen.queryByText('图片大小不得超过 5MB')).toBeNull();
        expect(document.querySelector('img[src="file://ok.jpg"]')).toBeTruthy();
      });
    });
  });
});
