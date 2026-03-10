---
name: test-review
description: Reviews test code (E2E and unit) for brittleness, flakiness, and anti-patterns. Use this when writing or fixing tests, or before committing test changes.
---

## Test Review Process

Review all test code as an experienced test engineer would. The project has two test layers:

| Layer | Framework | Location | Runner |
|-------|-----------|----------|--------|
| **Unit** | Vitest 4.x | `tests/unit-js/*.test.js` | `npm test` / `npm run test:watch` |
| **E2E** | Playwright + pytest-xdist (6 workers) | `tests/e2e/test_*.py` | `./run-tests.sh --browser chromium` |

### Phase 1: Scope detection

Identify changed test files:

```bash
git --no-pager diff --name-only | grep -E 'tests/e2e/|tests/unit-js/|pytest.ini'
```

If no test files changed, check if source changes require new tests:
- New scenes → E2E test file + `run-tests.sh` smart mapping entry
- New buttons/UI → E2E navigation tests
- New game mechanics → E2E gameplay tests
- New config values/formulas → unit tests
- New utility functions → unit tests
- New procedural generation logic → unit tests with deterministic seeds

### Phase 2: Test design quality

Review each test for sound engineering:

#### Test naming and intent
- **Name describes the expected behavior**, not the mechanism: `test_escape_returns_to_menu` ✅ not `test_press_escape_key` ❌
- **Docstring explains the regression** or user story being validated, not just rephrasing the name
- **One assertion per logical behavior** — a test can have multiple `assert` statements if they all verify aspects of the same behavior, but should not test two unrelated things

#### Arrange / Act / Assert structure
Every test should have clear phases. Flag tests that intermix setup with verification.
```python
# ✅ Clear AAA
def test_pause_resumes_gameplay(self, game_page):
    # Arrange
    click_button(game_page, BUTTON_START, "Start Game")
    wait_for_scene(game_page, 'GameScene')
    dismiss_dialogues(game_page)
    # Act
    game_page.keyboard.press("Escape")
    wait_for_scene(game_page, 'PauseScene')
    wait_for_input_ready(game_page, 'PauseScene')
    game_page.keyboard.press("Escape")
    # Assert
    wait_for_scene_inactive(game_page, 'PauseScene')
    assert_scene_active(game_page, 'GameScene')
```

#### Assertion quality
- **Assert on behavior, not implementation** — check what the user sees, not internal state when possible
- **Meaningful error messages** — include actual vs expected: `f"Should be on level 0, got {level}"` not just `assert level == 0`
- **Not over-specified** — don't assert on exact pixel positions, frame counts, or timing values that vary under load
- **Not under-specified** — every test must have at least one assertion; flag any test that only calls functions without asserting outcomes

#### Edge cases and failure paths
Check that the test suite covers:
- **Happy path** — normal user flow works
- **Error recovery** — what happens when a scene transition fails, fuel runs out, timer expires
- **Boundary conditions** — first level, last level, zero values, max values
- **Interruption** — pause during transition, resize during dialogue, orientation change during gameplay
- **State reset** — returning to menu clears game state properly

### Phase 3: Project-specific anti-patterns

Launch explore agents to check each changed test file for these patterns:

#### 1. Hardcoded button indices ❌

**Bad:** Breaks when menu order changes (caused 20+ failures in one session).
```python
click_button(page, 3, "Settings")  # ❌ fragile index
BUTTON_SETTINGS = 3                # ❌ stale constant
```

**Good:** Key-based lookup immune to reordering.
```python
click_menu_by_key(page, 'settings')                            # ✅ MenuScene
idx = find_menu_button_index(page, 'skipRun', 'PauseScene')   # ✅ any scene
```

All four button-bearing scenes have data keys via `button.setData('key', keyName)`:
- **MenuScene**: `'startGame'`, `'resumeGame'`, `'newGame'`, `'levelSelect'`, `'dailyRuns'`, `'howToPlay'`, `'changelog'`, `'settings'`
- **PauseScene**: `'resume'`, `'restart'`, `'skipRun'`, `'settings'`, `'quit'`, `'newRun'`, `'quitGame'`
- **LevelCompleteScene**: `'nextLevel'`, `'retry'`, `'ski'`, `'skiAgain'`, `'menu'`, `'viewCredits'`, `'dailyRuns'`
- **CreditsScene**: `'playAgain'`, `'menu'`

**Exception:** `BUTTON_START = 0` is safe — the primary action button is always first. But prefer `click_menu_by_key(page, 'startGame')` for clarity.

#### 2. Fixed timeouts instead of state polling ❌

**Bad:** Fails under CPU contention from parallel workers.
```python
page.wait_for_timeout(350)         # ❌ races with SCENE_INPUT_DELAY
page.wait_for_timeout(300)         # ❌ grooming might not register yet
```

**Good:** Poll actual game state.
```python
wait_for_input_ready(page, 'PauseScene')   # ✅ waits for inputReady === true
page.wait_for_function(f"""() => {{        # ✅ polls until condition met
    const gs = window.game.scene.getScene('GameScene');
    return gs && gs.groomedCount > {initial};
}}""", timeout=5000)
```

**When `wait_for_timeout` IS acceptable:**
- Between rapid keyboard events (50ms for ArrowDown sequences)
- After scene transitions when waiting for render (500ms + state check)
- Never as the sole mechanism to verify game state changed

#### 3. Missing inputReady wait ❌

**Bad:** Sends input before scene is ready to receive it.
```python
wait_for_scene(page, 'PauseScene')
page.keyboard.press("Escape")      # ❌ might be ignored
```

**Good:** Wait for the scene's input delay to expire.
```python
wait_for_scene(page, 'PauseScene')
wait_for_input_ready(page, 'PauseScene')
page.keyboard.press("Escape")      # ✅ scene is listening
```

Scenes with `BALANCE.SCENE_INPUT_DELAY` (300ms): PauseScene, LevelCompleteScene, LevelSelectScene, SettingsScene, CreditsScene. Always use `wait_for_input_ready` before keyboard events on these scenes.

#### 4. Container-relative coordinate bugs ❌

**Bad:** Uses local coordinates as if they were screen coordinates.
```python
pos = page.evaluate("""() => {
    const btn = scene.menuButtons[0];
    return { x: btn.x, y: btn.y };  // ❌ local to container
}""")
page.mouse.click(box["x"] + pos["x"], box["y"] + pos["y"])
```

**Good:** Account for parent container offset.
```python
pos = page.evaluate("""() => {
    const btn = scene.menuButtons[0];
    const cx = btn.parentContainer ? btn.parentContainer.x : 0;
    const cy = btn.parentContainer ? btn.parentContainer.y : 0;
    return { x: cx + btn.x, y: cy + btn.y };  // ✅ screen coords
}""")
```

#### 5. Tight explicit timeouts ❌

**Bad:** Overrides default timeout with a value too tight for parallel execution.
```python
wait_for_scene(page, 'SettingsScene', timeout=3000)  # ❌ too tight
```

**Good:** Use the default (8s) or a generous explicit timeout.
```python
wait_for_scene(page, 'SettingsScene')                 # ✅ uses 8s default
wait_for_scene(page, 'GameScene', timeout=10000)      # ✅ generous for slow transitions
```

The default timeout (8s) accounts for 6 parallel workers sharing CPU. Only override with larger values (10s+ for level loads, 30s for full ski runs).

#### 6. Duplicated conftest helpers ❌

**Bad:** Inline evaluate duplicating a conftest function.
```python
idx = page.evaluate("""() => {
    const scene = window.game?.scene?.getScene('MenuScene');
    return scene.menuButtons.findIndex(b => b.getData('key') === 'settings');
}""")                              # ❌ duplicates find_menu_button_index
```

**Good:** Import and use the helper.
```python
from conftest import find_menu_button_index
idx = find_menu_button_index(page, 'settings')  # ✅
```

#### 7. Checking local depth instead of effective depth ❌

**Bad:** Checks depth of objects inside containers — reports 0 when the container has the depth.
```python
assert btn.depth >= 10  # ❌ local depth is 0, container depth is 10
```

**Good:** Compute effective depth.
```python
containerDepth = btn.parentContainer ? btn.parentContainer.depth : 0
effectiveDepth = btn.depth + containerDepth  # ✅
```

#### 8. Missing smart test mapping ❌

When adding new source files or test files, update `run-tests.sh`:
- New `src/scenes/FooScene.ts` → add case branch mapping to test file(s)
- New `tests/e2e/test_foo.py` → add to `KNOWN_E2E_FILES`
- Renamed scenes → update both the case branch and `SCENE_TESTS` mapping

#### 9. scene.restart() race condition ❌

**Bad:** `scene.restart()` destroys and recreates the scene. `wait_for_scene` may return before buttons exist, and `getScene()` may return a stale reference mid-restart.
```python
page.evaluate("window.game.scene.getScene('MenuScene')?.scene.restart()")
wait_for_scene(page, 'MenuScene')       # ❌ may return immediately (scene was active)
click_menu_by_key(page, 'changelog')    # ❌ buttons may not exist yet
```

**Good:** Avoid `scene.restart()` entirely. Navigate away and back, or operate on the scene as-is. If restart is truly needed, poll for buttons to exist:
```python
# Preferred: navigate away and back
click_menu_by_key(page, 'settings')
wait_for_scene(page, 'SettingsScene')
page.keyboard.press("Escape")
wait_for_scene(page, 'MenuScene')

# If restart unavoidable: wait for buttons
page.evaluate("window.game.scene.getScene('MenuScene')?.scene.restart()")
wait_for_scene(page, 'MenuScene')
page.wait_for_function("() => window.game?.scene?.getScene('MenuScene')?.menuButtons?.length > 0", timeout=8000)
```

#### 10. Emitting wrong pointer event ❌

**Bad:** MenuScene buttons use `pointerup`, not `pointerdown`. Other scenes may differ.
```python
btn.emit('pointerdown')  # ❌ MenuScene buttons listen on pointerup
```

**Good:** Check the scene source for which event triggers the callback, or use keyboard navigation instead.
```python
click_menu_by_key(page, 'changelog')  # ✅ uses keyboard — avoids event name guessing
```

### Phase 4: Maintainability

1. **DRY without over-abstraction** — Shared setup belongs in conftest fixtures or helper functions. But don't abstract away test clarity; a reader should understand what a test does without jumping to 5 helpers.
2. **Test class grouping** — Related tests grouped in classes (`TestPauseMenu`, `TestSkiJump`). Classes should share a common setup pattern and test a single feature area.
3. **Consistent patterns across files** — Same flow (start game → navigate → assert) should use the same helpers everywhere. New test files should follow the established structure of existing ones.
4. **No orphaned tests** — Tests that were disabled, skipped, or commented out should be deleted or fixed. `@pytest.mark.skip` must have a reason.
5. **Import hygiene** — Only import what's used. Don't import removed constants (`BUTTON_SETTINGS` etc.).

### Phase 5: Parallel safety and isolation

1. **No shared mutable state** — Tests must not depend on localStorage from other tests (fixture clears it)
2. **No port conflicts** — All tests use `GAME_URL` from conftest (reads PORT from `.env.local`)
3. **No file system side effects** — Screenshots go to `tests/screenshots/` only
4. **Idempotent setup** — Each test must work regardless of execution order
5. **No test interdependence** — Test A must not set state that test B relies on. If you see tests that only pass when run together, flag as HIGH.
6. **Deterministic behavior** — Tests must not depend on wall-clock time, random values, or network. Game uses seeded RNG for daily runs; tests should inject known seeds when testing procedural content.

### Phase 6: Coverage assessment

For changed or new features, verify:

1. **Critical path covered** — Can the user complete the main flow without hitting untested code?
2. **Regression test for bugs** — Every bug fix should have a test that would have caught it. The docstring should reference what broke.
3. **Input method coverage** — Keyboard, mouse/touch, gamepad should all be tested for interactive features. At minimum, keyboard (most reliable in Playwright).
4. **Viewport coverage** — Tests that depend on layout should verify at least the default viewport (1280×720). Responsive-critical features use the `touch_page` fixture (390×844 portrait).

### Phase 7: Findings

Organize by severity:

| Severity | Criteria |
|----------|----------|
| **HIGH** | Will fail under parallel load, breaks on menu reorder, uses wrong coordinates, tests depend on each other, no assertions, scene.restart() race |
| **MEDIUM** | Duplicates helpers, uses unnecessarily tight timeouts, missing inputReady, poor error messages, tests multiple unrelated behaviors, wrong pointer event |
| **LOW** | Style inconsistency, could use a better helper but works correctly, missing edge case coverage |

### Phase 8: Flaky test handling

When a test fails intermittently during review or CI:

1. **Reproduce** — run the failing test in isolation 3 times: `./run-tests.sh --browser chromium -k "test_name"`
2. **Diagnose** — common flakiness causes in this project:
   - Missing `wait_for_input_ready` before keyboard/pointer events
   - Tight explicit timeouts (< 5s) under parallel load
   - `wait_for_timeout` as sole state-check mechanism
   - Scene transition race conditions (polling `isActive` before scene fully initialized)
   - `scene.restart()` without waiting for buttons to re-create
3. **Fix immediately** — do not skip, defer, or mark as known-flaky. Replace timing assumptions with state polling. If the root cause is unclear, add retry logic as a last resort with a `# TODO: investigate flakiness` comment.
4. **Verify stability** — run the fixed test 3 times in parallel context (`./run-tests.sh --browser chromium`) to confirm it's stable.

Severity: flaky tests are always **HIGH** — they erode trust in the suite and waste debugging time.

### Phase 9: Verification

```bash
# Run changed tests in isolation
./run-tests.sh --browser chromium -k "test_name"

# Run full suite to check parallel stability
./run-tests.sh --browser chromium

# 248/248 should pass consistently across 2+ runs
```

## Available conftest helpers

| Helper | Purpose |
|--------|---------|
| `click_menu_by_key(page, key)` | Click menu button by data key (immune to reorder) |
| `find_menu_button_index(page, key, scene)` | Get button index by data key (any scene) |
| `click_button(page, index, desc)` | Click by index (for non-menu buttons like pause menu) |
| `wait_for_scene(page, name)` | Wait for scene active (8s default) |
| `wait_for_scene_inactive(page, name)` | Wait for scene to stop |
| `wait_for_input_ready(page, name)` | Wait for SCENE_INPUT_DELAY |
| `wait_for_game_ready(page)` | Wait for MenuScene (used by fixture) |
| `dismiss_dialogues(page)` | Dismiss any active briefing dialogues |
| `skip_to_level(page, N)` | Skip forward to level N |
| `navigate_to_daily_runs(page)` | Navigate to DailyRunsScene |
| `navigate_to_settings(page)` | Navigate to SettingsScene |
| `assert_scene_active(page, name)` | Assert scene is active |
| `assert_scene_not_active(page, name)` | Assert scene is not active |
| `get_active_scenes(page)` | List all active scene keys |
| `get_current_level(page)` | Get current GameScene level index |

---

## Unit Test Review (Vitest)

Unit tests validate pure logic — config values, math formulas, procedural generation, utility functions — without needing a browser. They should be fast, deterministic, and focused.

### Unit test architecture

```
tests/unit-js/
├── config-wrappers/
│   └── index.js          # Re-exports from src/ TS modules + global mocks
├── gameConfig.test.js     # Config values, BALANCE constants
├── levels.test.js         # Level definitions, time limits
├── levelGenerator.test.js # Procedural generation, seed determinism
├── frost.test.js          # Freeze rate math, speed multipliers
├── foodBuff.test.js       # Food buff calculations
├── groomingQuality.test.js # Grooming formula verification
├── gameProgress.test.js   # localStorage persistence, level unlock logic
├── localization.test.js   # Translation key parity across all languages
├── keyboardLayout.test.js # Layout switching, key name resolution
├── gamepad.test.js        # Controller mapping, axis handling
├── yDepth.test.js         # Y-based depth sorting
├── characterPortraits.test.js # Portrait config validation
└── parkFeatures.test.js   # Park feature definitions
```

### Config wrappers pattern

All unit tests import through `tests/unit-js/config-wrappers/index.js` — a re-export layer that:
1. **Polyfills browser globals** — `localStorage`, `navigator`, `Phaser.Math.RandomDataGenerator`
2. **Re-exports TS source modules** — so tests import from one place

```javascript
// ✅ Import through wrappers
import { BALANCE, LEVELS } from './config-wrappers/index.js';

// ❌ Don't import source directly (mocks won't be set up)
import { BALANCE } from '../../../src/config/gameConfig.ts';
```

### Unit test anti-patterns

#### 1. Missing mock setup ❌

**Bad:** Test imports source module before mocks are established.
```javascript
import { generateDailyRunLevel } from '../../../src/systems/LevelGenerator.ts'; // ❌
// Phaser.Math.RandomDataGenerator not available → crash
```

**Good:** Import through config-wrappers which sets up mocks first.
```javascript
import { generateDailyRunLevel } from './config-wrappers/index.js'; // ✅
```

#### 2. Shared state between tests ❌

**Bad:** Test relies on localStorage state from a previous test.
```javascript
it('saves progress', () => {
    saveProgress({ level: 3 });
});
it('reads saved progress', () => {
    const p = getSavedProgress(); // ❌ depends on test above
    expect(p.level).toBe(3);
});
```

**Good:** Each test sets up its own state.
```javascript
beforeEach(() => localStorage.clear());

it('saves and reads progress', () => {
    saveProgress({ level: 3 });
    const p = getSavedProgress(); // ✅ self-contained
    expect(p.level).toBe(3);
});
```

#### 3. Non-deterministic assertions ❌

**Bad:** Tests random output without controlling the seed.
```javascript
const level = generateDailyRunLevel();
expect(level.obstacles.length).toBeGreaterThan(0); // ❌ flaky, depends on random seed
```

**Good:** Use a known seed for reproducibility.
```javascript
const level = generateDailyRunLevel('fixed-seed-123');
expect(level.obstacles.length).toBe(12); // ✅ deterministic with this seed
```

#### 4. Testing implementation instead of behavior ❌

**Bad:** Asserts on internal structure that may change.
```javascript
expect(LEVELS[0]._internalFlags).toEqual([1, 0, 1]); // ❌ implementation detail
```

**Good:** Assert on the observable behavior.
```javascript
expect(LEVELS[0].timeLimit).toBeGreaterThan(0); // ✅ behavior contract
expect(computeTimeLimit(LEVELS[0])).toBe(120);  // ✅ function output
```

#### 5. Missing edge cases in math tests ❌

For formula/math tests (frost, food buffs, grooming quality), always test:
- **Zero values** — `frostRate(0)`, `buffMultiplier(0)`
- **Negative values** — if inputs can go negative
- **Boundary values** — min/max level, first/last food item
- **Extreme values** — very large inputs, overflow potential

#### 6. Incomplete localization coverage ❌

The localization test dynamically discovers all keys. If adding new translatable strings:
- Add the key to ALL 14 language files
- The test should catch missing keys — verify it does
- Check that interpolation placeholders (`{0}`, `{1}`) match across languages

### Unit test quality checks

1. **Pure functions only** — Unit tests should not depend on DOM, Canvas, or Phaser runtime. If a function needs Phaser objects, it belongs in E2E tests.
2. **Fast execution** — All unit tests should complete in < 5 seconds total. Flag any test that takes > 500ms.
3. **Descriptive names** — `it('returns 0 grooming quality when snowfall exceeds threshold')` ✅ not `it('test case 1')` ❌
4. **No network or filesystem** — Unit tests must not make HTTP requests or write files.
5. **Snapshot sparingly** — Prefer explicit assertions over snapshot tests. Snapshots hide what matters and break on any formatting change.

### Running unit tests

```bash
# Full suite
npm test

# Watch mode (re-runs on save)
npm run test:watch

# Single file
npx vitest run tests/unit-js/frost.test.js

# Pattern match
npx vitest run -t "freeze rate"
```
