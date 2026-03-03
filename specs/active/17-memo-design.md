# Technical Design Document: Memo 输入框实时字数统计

**作者**: AI Agent
**日期**: 2026-03-03
**状态**: Draft
**关联 Spec**: specs/active/17-memo.md
**关联 Issue**: #17

---

## 1. Architecture Overview

This feature is a **pure frontend enhancement** that adds real-time character counting to the Memo input experience. It integrates into the existing Next.js App Router application without requiring any backend modifications.

### System Context

```
┌─────────────────────────────────────────┐
│  User Interface (Client-Side)           │
│  ┌───────────────────────────────────┐  │
│  │ Memo Input Page                   │  │
│  │ - Textarea (existing)             │  │
│  │ - Character Counter (NEW)         │  │
│  │ - Submit Button (enhanced)        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
         │
         │ No API calls for character counting
         │ (Backend validation remains unchanged)
         ▼
┌─────────────────────────────────────────┐
│  Backend API                             │
│  POST /api/memos                         │
│  - Validates content.length ≤ 10,000    │
│  - (existing validation logic)           │
└─────────────────────────────────────────┘
```

### Integration Points

- **Existing**: `apps/flomo/app/page.tsx` — Current minimal homepage
- **New**: Memo input component to be created at `apps/flomo/app/components/memo-input.tsx`
- **Styling**: Uses existing CSS variables and utility classes from `apps/flomo/app/globals.css`

---

## 2. Data Model Changes

**NO DATABASE CHANGES REQUIRED**

This feature operates entirely in the client-side React state. The existing Prisma schema remains unchanged:

```prisma
model Note {
  id        String    @id @default(cuid())
  userId    String
  title     String?
  content   String    // ← Still validated as ≤ 10,000 on backend
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tags      NoteTag[]
}
```

**Validation Strategy**:
- Frontend: Real-time character counting + submit button disable
- Backend: Existing validation in API route (final safeguard)

---

## 3. API Endpoints

**NO NEW API ENDPOINTS**

The existing `POST /api/memos` endpoint (to be created as part of base Memo functionality) will continue to validate:

```typescript
// apps/flomo/app/api/memos/route.ts (hypothetical future implementation)
export async function POST(request: Request) {
  const body = await request.json();

  // Existing validation
  if (body.content.length > 10000) {
    return Response.json(
      { data: null, error: 'Content exceeds 10,000 characters', message: 'Validation failed' },
      { status: 400 }
    );
  }

  // ... rest of implementation
}
```

**Note**: The API endpoint above is illustrative. For Issue #17, we are ONLY implementing the frontend character counter. Backend implementation is out of scope.

---

## 4. Component Structure

### 4.1 Component Hierarchy

```
apps/flomo/app/
├── page.tsx (updated)
│   └── <MemoInput /> (NEW)
└── components/
    └── memo-input.tsx (NEW)
```

### 4.2 MemoInput Component Specification

**File**: `apps/flomo/app/components/memo-input.tsx`

```typescript
'use client';

import { useState, ChangeEvent, FormEvent } from 'react';

const MAX_CHARS = 10000;
const WARNING_THRESHOLD = 9000;

interface MemoInputProps {
  onSubmit?: (content: string) => void;
}

export default function MemoInput({ onSubmit }: MemoInputProps) {
  const [content, setContent] = useState('');
  const charCount = content.length;

  // Determine color state
  const getCounterColor = (): string => {
    if (charCount > MAX_CHARS) return 'text-red-500';
    if (charCount > WARNING_THRESHOLD) return 'text-orange-500';
    return 'text-gray-500';
  };

  // Handle textarea change
  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  };

  // Handle form submission
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (charCount > 0 && charCount <= MAX_CHARS && onSubmit) {
      onSubmit(content);
    }
  };

  const isSubmitDisabled = charCount === 0 || charCount > MAX_CHARS;

  return (
    <form onSubmit={handleSubmit} className="form-stack">
      <div>
        <textarea
          value={content}
          onChange={handleChange}
          placeholder="记录你的想法..."
          className="memo-textarea"
        />
        <div className={`char-counter ${getCounterColor()}`}>
          {charCount} / {MAX_CHARS}
        </div>
      </div>
      <button type="submit" disabled={isSubmitDisabled}>
        保存
      </button>
    </form>
  );
}
```

### 4.3 Updated Page Component

**File**: `apps/flomo/app/page.tsx`

```typescript
import MemoInput from './components/memo-input';

export default function HomePage() {
  return (
    <div className="card">
      <h2>新建 Memo</h2>
      <MemoInput onSubmit={(content) => {
        console.log('Memo content:', content);
        // TODO: Integrate with API when backend is ready
      }} />
    </div>
  );
}
```

### 4.4 CSS Additions

**File**: `apps/flomo/app/globals.css` (append to end)

```css
/* Character counter styling */
.char-counter {
  text-align: right;
  font-size: 0.875rem;
  margin-top: 8px;
  transition: color 0.2s ease;
}

.text-gray-500 {
  color: var(--muted);
}

.text-orange-500 {
  color: #f97316;
}

.text-red-500 {
  color: #ef4444;
}
```

### 4.5 Component State Management

| State Variable | Type | Purpose |
|---------------|------|---------|
| `content` | `string` | Stores textarea value |
| `charCount` | `number` (derived) | `content.length` — triggers re-render on change |

**Performance Consideration**: Using `content.length` directly is O(1) in JavaScript engines due to internal string length caching. No memoization needed.

---

## 5. Technical Constraints

### 5.1 Performance

**Requirement**: Input response must be < 50ms latency

**Strategy**:
- React's default re-render for `onChange` is sufficient (typically < 16ms)
- Avoid debouncing — users expect instant feedback
- `String.length` is O(1) — no performance concern even for 10,000 chars

**Edge Case**: Pasting large text (>10,000 chars)
- React will handle this synchronously
- No UI freeze expected (tested in similar apps)

### 5.2 Character Counting Logic

**Spec Requirement**: Use JavaScript `String.length`

**Implications**:
- Emoji (e.g., 👍) may count as 2 characters (surrogate pair)
- Newline `\n` counts as 1 character
- This matches backend validation logic

**Example**:
```javascript
"Hello\n世界👍".length  // = 9 (not 7)
```

**Alignment**: Frontend and backend must use identical counting logic to prevent mismatch errors.

### 5.3 Browser Compatibility

**Target**: Modern browsers (Chrome/Edge/Safari/Firefox last 2 versions)

**Used Features**:
- React hooks (`useState`, `ChangeEvent`) — fully supported
- CSS custom properties — fully supported
- No polyfills required

### 5.4 Accessibility

**Considerations**:
- Screen reader should announce character count
- Submit button's disabled state should be perceivable

**Enhancements** (not in scope for Issue #17):
- Add `aria-live="polite"` to character counter
- Add `aria-describedby` linking textarea to counter

### 5.5 Security

**No new security risks introduced**:
- Character counting is client-side computation only
- No user input is sent to server during counting
- Backend validation remains the authoritative safeguard
- XSS prevention: Content is rendered in `<textarea>` (inherently safe)

---

## 6. Dependencies

**NO NEW NPM PACKAGES REQUIRED**

All necessary dependencies are already in `package.json`:

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "next": "^14.2.5"
  }
}
```

**Justification**:
- React hooks (`useState`) — built-in
- TypeScript types (`ChangeEvent`, `FormEvent`) — built-in
- CSS — custom styles using existing variables

---

## 7. Implementation Plan

### Phase 1: Component Structure (15 min)
1. Create `apps/flomo/app/components/memo-input.tsx`
2. Implement basic component shell with TypeScript interfaces
3. Add static UI elements (textarea + counter + button)

### Phase 2: State Management (10 min)
1. Add `useState` for content
2. Bind `onChange` handler to textarea
3. Derive `charCount` from `content.length`

### Phase 3: Conditional Styling (10 min)
1. Implement `getCounterColor()` logic
2. Add CSS utility classes to `globals.css`
3. Apply dynamic className to counter

### Phase 4: Submit Button Logic (5 min)
1. Calculate `isSubmitDisabled` based on `charCount`
2. Apply `disabled` attribute conditionally

### Phase 5: Integration (5 min)
1. Update `apps/flomo/app/page.tsx` to render `<MemoInput />`
2. Add placeholder `onSubmit` handler

### Phase 6: Testing (15 min)
1. Manual test: type text and verify counter updates
2. Manual test: input 9001 chars → orange warning
3. Manual test: input 10001 chars → red + disabled button
4. Manual test: paste large text block
5. Visual inspection: button disabled state styling

**Total Estimated Time**: ~60 minutes

---

## 8. Testing Strategy

### 8.1 Manual Test Cases

| Test Case | Steps | Expected Result |
|-----------|-------|-----------------|
| Initial state | Open page | Shows "0 / 10000" in gray |
| Type text | Input "Hello" | Shows "5 / 10000" in gray |
| Warning threshold | Input 9001 chars | Counter turns orange |
| Exceed limit | Input 10001 chars | Counter turns red, button disabled |
| Delete to valid | Delete chars back to 10000 | Counter turns orange, button enabled |
| Empty submit | Clear all text | Button disabled |
| Paste large text | Paste 15000 char string | Counter shows "15000 / 10000" in red, button disabled |
| Emoji counting | Input "👍👍👍" | Shows "6 / 10000" (each emoji = 2 chars) |

### 8.2 Validation Checklist

**From spec file** (specs/active/17-memo.md):
- [ ] Initial display "0 / 10000"
- [ ] Real-time update on input
- [ ] Color changes at 9001 (orange) and 10001 (red)
- [ ] Submit button disabled when > 10000
- [ ] Button re-enabled when ≤ 10000
- [ ] Paste large text handled correctly
- [ ] Emoji counting matches backend
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Smooth input response (< 50ms)

### 8.3 Build Verification

```bash
cd apps/flomo
npm run build
```

Expected: No errors, no TypeScript warnings.

---

## 9. Edge Cases & Boundary Conditions

| Scenario | Behavior |
|----------|----------|
| Exactly 10000 chars | Orange "10000 / 10000", button enabled |
| Exactly 10001 chars | Red "10001 / 10000", button disabled |
| Empty textarea | Gray "0 / 10000", button disabled (empty content check) |
| Newline characters | Each `\n` counts as 1 character |
| Tabs | Each tab counts as 1 character |
| Mixed emoji/text | Use `String.length` (may be >1 per emoji) |
| Rapid typing | React batches updates, no performance issue |
| Copy-paste | `onChange` fires once with full content |

---

## 10. Rollback Plan

**If Critical Issue Found**:
1. Remove `<MemoInput />` from `page.tsx`
2. Restore original `<div>AIFlomo</div>` placeholder
3. Delete `apps/flomo/app/components/memo-input.tsx`
4. Remove CSS additions from `globals.css`

**Risk Assessment**: Very low — this is isolated UI component with no backend dependencies.

---

## 11. Future Enhancements (Out of Scope)

Explicitly excluded from Issue #17:
- ❌ Internationalization (i18n for character count label)
- ❌ Separate tag character counting
- ❌ Rich text editor integration
- ❌ Character count history/analytics
- ❌ Reading time estimation
- ❌ Accessibility enhancements (ARIA labels)
- ❌ Backend API integration (requires separate Memo CRUD implementation)

---

## 12. Success Criteria

### Functional
- ✅ Character counter displays correct count in real-time
- ✅ Color transitions at 9001 and 10001 thresholds
- ✅ Submit button disabled when count > 10000
- ✅ No TypeScript/ESLint errors

### Non-Functional
- ✅ Input latency < 50ms
- ✅ No UI freeze when pasting large text
- ✅ Code follows project conventions (camelCase, no `any`)
- ✅ Minimal diff (only new component + small page update)

### Documentation
- ✅ This design doc completed
- ✅ Inline code comments for non-obvious logic (if any)

---

## Appendix A: File Change Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `apps/flomo/app/components/memo-input.tsx` | **CREATE** | New client component for Memo input with counter |
| `apps/flomo/app/page.tsx` | **MODIFY** | Replace placeholder with `<MemoInput />` |
| `apps/flomo/app/globals.css` | **MODIFY** | Add `.char-counter` and color utility classes |

**Total Files Changed**: 3
**Lines Added**: ~80
**Lines Removed**: ~1

---

**Document Status**: Ready for implementation
**Next Step**: Begin Phase 1 (Component Structure)
