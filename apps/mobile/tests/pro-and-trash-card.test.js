import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mock react-native ────────────────────────────────────────────────────────

vi.mock('react-native', () => ({
  View: ({ children, style, testID }) =>
    React.createElement('div', { style, 'data-testid': testID }, children),
  Text: ({ children, style, testID, numberOfLines }) =>
    React.createElement('span', { style, 'data-testid': testID, 'data-lines': numberOfLines }, children),
  Pressable: ({ children, onPress, testID, style, accessibilityRole, accessibilityLabel }) =>
    React.createElement(
      'button',
      { onClick: onPress, 'data-testid': testID, style, role: accessibilityRole, 'aria-label': accessibilityLabel },
      children
    ),
  ScrollView: ({ children, horizontal, style, testID, showsHorizontalScrollIndicator, contentContainerStyle }) =>
    React.createElement('div', { style, 'data-horizontal': horizontal, 'data-testid': testID }, children),
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

import { ProUpgradeModal } from '../components/ProUpgradeModal';
import { TrashMemoCard } from '../components/TrashMemoCard';

// ─── ProUpgradeModal Tests ────────────────────────────────────────────────────

describe('ProUpgradeModal', () => {
  describe('visibility', () => {
    it('does not render when visible=false', () => {
      render(React.createElement(ProUpgradeModal, { visible: false, onClose: vi.fn() }));
      expect(screen.queryByTestId('pro-upgrade-modal')).toBeNull();
    });

    it('renders when visible=true', () => {
      render(React.createElement(ProUpgradeModal, { visible: true, onClose: vi.fn() }));
      expect(screen.getByTestId('pro-upgrade-modal')).toBeTruthy();
    });

    it('renders with custom testID when provided', () => {
      render(React.createElement(ProUpgradeModal, { visible: true, onClose: vi.fn(), testID: 'my-modal' }));
      expect(screen.getByTestId('my-modal')).toBeTruthy();
    });
  });

  describe('content rendering', () => {
    it('renders the PRO badge', () => {
      render(React.createElement(ProUpgradeModal, { visible: true, onClose: vi.fn() }));
      expect(screen.getByText('PRO')).toBeTruthy();
    });

    it('renders default title "升级 Pro 会员" when featureName is not provided', () => {
      render(React.createElement(ProUpgradeModal, { visible: true, onClose: vi.fn() }));
      expect(screen.getByTestId('pro-upgrade-modal-title').textContent).toBe('升级 Pro 会员');
    });

    it('renders feature-specific title when featureName is provided', () => {
      render(React.createElement(ProUpgradeModal, { visible: true, onClose: vi.fn(), featureName: '微信输入' }));
      expect(screen.getByTestId('pro-upgrade-modal-title').textContent).toContain('微信输入');
    });

    it('renders the subtitle text', () => {
      render(React.createElement(ProUpgradeModal, { visible: true, onClose: vi.fn() }));
      expect(screen.getByText('解锁全部高级功能，让记录更高效')).toBeTruthy();
    });

    it('renders all 4 PRO features', () => {
      render(React.createElement(ProUpgradeModal, { visible: true, onClose: vi.fn() }));
      expect(screen.getByText('微信输入')).toBeTruthy();
      expect(screen.getByText('每日回顾')).toBeTruthy();
      expect(screen.getByText('AI 洞察')).toBeTruthy();
      expect(screen.getByText('随机漫步')).toBeTruthy();
    });

    it('renders the buy button', () => {
      render(React.createElement(ProUpgradeModal, { visible: true, onClose: vi.fn() }));
      expect(screen.getByTestId('pro-upgrade-modal-buy-btn')).toBeTruthy();
    });

    it('renders "立即购买" text in the buy button', () => {
      render(React.createElement(ProUpgradeModal, { visible: true, onClose: vi.fn() }));
      expect(screen.getByText('立即购买')).toBeTruthy();
    });

    it('renders the cancel button', () => {
      render(React.createElement(ProUpgradeModal, { visible: true, onClose: vi.fn() }));
      expect(screen.getByTestId('pro-upgrade-modal-cancel-btn')).toBeTruthy();
    });

    it('renders "暂不购买" text in the cancel button', () => {
      render(React.createElement(ProUpgradeModal, { visible: true, onClose: vi.fn() }));
      expect(screen.getByText('暂不购买')).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('calls onClose when cancel button is pressed', () => {
      const onClose = vi.fn();
      render(React.createElement(ProUpgradeModal, { visible: true, onClose }));
      fireEvent.click(screen.getByTestId('pro-upgrade-modal-cancel-btn'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when overlay is pressed', () => {
      const onClose = vi.fn();
      render(React.createElement(ProUpgradeModal, { visible: true, onClose }));
      fireEvent.click(screen.getByTestId('pro-upgrade-modal-overlay'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose and onBuyPress when buy button is pressed and onBuyPress is provided', () => {
      const onClose = vi.fn();
      const onBuyPress = vi.fn();
      render(React.createElement(ProUpgradeModal, { visible: true, onClose, onBuyPress }));
      fireEvent.click(screen.getByTestId('pro-upgrade-modal-buy-btn'));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onBuyPress).toHaveBeenCalledTimes(1);
    });

    it('calls onClose and navigates when buy button is pressed and onBuyPress is not provided', () => {
      const onClose = vi.fn();
      render(React.createElement(ProUpgradeModal, { visible: true, onClose }));
      fireEvent.click(screen.getByTestId('pro-upgrade-modal-buy-btn'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('custom testID elements', () => {
    it('renders modal elements with custom testID prefix', () => {
      render(
        React.createElement(ProUpgradeModal, { visible: true, onClose: vi.fn(), testID: 'custom' })
      );
      expect(screen.getByTestId('custom')).toBeTruthy();
      expect(screen.getByTestId('custom-overlay')).toBeTruthy();
      expect(screen.getByTestId('custom-sheet')).toBeTruthy();
      expect(screen.getByTestId('custom-title')).toBeTruthy();
      expect(screen.getByTestId('custom-buy-btn')).toBeTruthy();
      expect(screen.getByTestId('custom-cancel-btn')).toBeTruthy();
    });
  });
});

// ─── TrashMemoCard Tests ──────────────────────────────────────────────────────

describe('TrashMemoCard', () => {
  function makeMemo(overrides = {}) {
    return {
      id: 'trash-1',
      content: 'Deleted memo content',
      createdAt: new Date(Date.now() - 60000).toISOString(),
      deletedAt: new Date(Date.now() - 30000).toISOString(),
      tags: [],
      ...overrides,
    };
  }

  describe('rendering', () => {
    it('renders the card with correct testID', () => {
      const memo = makeMemo({ id: 'tc1' });
      render(React.createElement(TrashMemoCard, { memo }));
      expect(screen.getByTestId('trash-card-tc1')).toBeTruthy();
    });

    it('renders the deleted label element', () => {
      const memo = makeMemo({ id: 'tc-del-lbl' });
      render(React.createElement(TrashMemoCard, { memo }));
      expect(screen.getByTestId('trash-deleted-label-tc-del-lbl')).toBeTruthy();
    });

    it('renders the memo content', () => {
      const memo = makeMemo({ id: 'tc2', content: 'This is deleted content' });
      render(React.createElement(TrashMemoCard, { memo }));
      expect(screen.getByTestId('trash-content-tc2').textContent).toBe('This is deleted content');
    });

    it('renders the date text', () => {
      const memo = makeMemo({ id: 'tc3' });
      render(React.createElement(TrashMemoCard, { memo }));
      expect(screen.getByTestId('trash-date-tc3')).toBeTruthy();
    });

    it('renders restore button', () => {
      const memo = makeMemo({ id: 'tc4' });
      render(React.createElement(TrashMemoCard, { memo }));
      expect(screen.getByTestId('trash-restore-btn-tc4')).toBeTruthy();
    });

    it('renders permanent delete button', () => {
      const memo = makeMemo({ id: 'tc5' });
      render(React.createElement(TrashMemoCard, { memo }));
      expect(screen.getByTestId('trash-permanent-delete-btn-tc5')).toBeTruthy();
    });

    it('does not render tags when memo has no tags', () => {
      const memo = makeMemo({ id: 'tc6', tags: [] });
      render(React.createElement(TrashMemoCard, { memo }));
      expect(screen.queryByTestId('trash-tags-tc6')).toBeNull();
    });

    it('renders tags when memo has tags (array of objects)', () => {
      const memo = makeMemo({ id: 'tc7', tags: [{ name: 'work' }, { name: 'life' }] });
      render(React.createElement(TrashMemoCard, { memo }));
      expect(screen.getByTestId('trash-tags-tc7')).toBeTruthy();
      expect(screen.getByText('#work')).toBeTruthy();
      expect(screen.getByText('#life')).toBeTruthy();
    });

    it('renders tags when memo has tags (array of strings)', () => {
      const memo = makeMemo({ id: 'tc8', tags: ['reading', 'notes'] });
      render(React.createElement(TrashMemoCard, { memo }));
      expect(screen.getByTestId('trash-tags-tc8')).toBeTruthy();
      expect(screen.getByText('#reading')).toBeTruthy();
      expect(screen.getByText('#notes')).toBeTruthy();
    });

    it('handles undefined tags gracefully (defaults to empty)', () => {
      const memo = { id: 'tc9', content: 'test', createdAt: new Date().toISOString() };
      render(React.createElement(TrashMemoCard, { memo }));
      expect(screen.queryByTestId('trash-tags-tc9')).toBeNull();
    });
  });

  describe('date formatting', () => {
    it('shows formatted date based on deletedAt when available', () => {
      const memo = makeMemo({ id: 'tc-date', deletedAt: new Date(Date.now() - 30000).toISOString() });
      render(React.createElement(TrashMemoCard, { memo }));
      expect(screen.getByTestId('trash-date-tc-date').textContent).toBe('刚刚');
    });

    it('falls back to createdAt when deletedAt is null', () => {
      const memo = makeMemo({ id: 'tc-no-del', deletedAt: null, createdAt: new Date(Date.now() - 30000).toISOString() });
      render(React.createElement(TrashMemoCard, { memo }));
      expect(screen.getByTestId('trash-date-tc-no-del').textContent).toBe('刚刚');
    });
  });

  describe('interactions', () => {
    it('calls onRestore with memo when restore button is pressed', () => {
      const onRestore = vi.fn();
      const memo = makeMemo({ id: 'tc-restore' });
      render(React.createElement(TrashMemoCard, { memo, onRestore }));
      fireEvent.click(screen.getByTestId('trash-restore-btn-tc-restore'));
      expect(onRestore).toHaveBeenCalledWith(memo);
    });

    it('does not throw when onRestore is not provided and restore is pressed', () => {
      const memo = makeMemo({ id: 'tc-no-restore' });
      render(React.createElement(TrashMemoCard, { memo }));
      expect(() =>
        fireEvent.click(screen.getByTestId('trash-restore-btn-tc-no-restore'))
      ).not.toThrow();
    });

    it('shows confirmation dialog when permanent delete button is pressed', () => {
      const memo = makeMemo({ id: 'tc-confirm' });
      render(React.createElement(TrashMemoCard, { memo }));
      fireEvent.click(screen.getByTestId('trash-permanent-delete-btn-tc-confirm'));
      expect(screen.getByTestId('trash-confirm-dialog-tc-confirm')).toBeTruthy();
    });

    it('hides confirmation dialog when cancel button in dialog is pressed', () => {
      const memo = makeMemo({ id: 'tc-cancel-confirm' });
      render(React.createElement(TrashMemoCard, { memo }));
      fireEvent.click(screen.getByTestId('trash-permanent-delete-btn-tc-cancel-confirm'));
      expect(screen.getByTestId('trash-confirm-dialog-tc-cancel-confirm')).toBeTruthy();

      const cancelBtn = screen.getByTestId('trash-confirm-dialog-tc-cancel-confirm-cancel');
      fireEvent.click(cancelBtn);
      expect(screen.queryByTestId('trash-confirm-dialog-tc-cancel-confirm')).toBeNull();
    });

    it('calls onPermanentDelete with memo when confirm button in dialog is pressed', () => {
      const onPermanentDelete = vi.fn();
      const memo = makeMemo({ id: 'tc-perm-del' });
      render(React.createElement(TrashMemoCard, { memo, onPermanentDelete }));
      fireEvent.click(screen.getByTestId('trash-permanent-delete-btn-tc-perm-del'));
      fireEvent.click(screen.getByTestId('trash-confirm-dialog-tc-perm-del-confirm'));
      expect(onPermanentDelete).toHaveBeenCalledWith(memo);
    });

    it('closes dialog after confirming permanent delete', () => {
      const onPermanentDelete = vi.fn();
      const memo = makeMemo({ id: 'tc-close-confirm' });
      render(React.createElement(TrashMemoCard, { memo, onPermanentDelete }));
      fireEvent.click(screen.getByTestId('trash-permanent-delete-btn-tc-close-confirm'));
      fireEvent.click(screen.getByTestId('trash-confirm-dialog-tc-close-confirm-confirm'));
      expect(screen.queryByTestId('trash-confirm-dialog-tc-close-confirm')).toBeNull();
    });

    it('does not throw when onPermanentDelete is not provided and confirm is pressed', () => {
      const memo = makeMemo({ id: 'tc-no-perm' });
      render(React.createElement(TrashMemoCard, { memo }));
      fireEvent.click(screen.getByTestId('trash-permanent-delete-btn-tc-no-perm'));
      expect(() =>
        fireEvent.click(screen.getByTestId('trash-confirm-dialog-tc-no-perm-confirm'))
      ).not.toThrow();
    });
  });
});
