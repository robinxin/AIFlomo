/**
 * Unit tests for apps/server/src/lib/password.js
 *
 * Covers the two public functions:
 *   - hashPassword(password)  — hashes a plaintext password with bcrypt (salt rounds = 10)
 *   - comparePassword(password, hash) — verifies a plaintext password against a bcrypt hash
 *
 * TDD phase: RED — the implementation file does not exist yet.
 * All tests below are expected to FAIL until src/lib/password.js is created.
 *
 * ESM note:
 *   The server package uses `"type": "module"`. Jest is run with
 *   `--experimental-vm-modules` so ESM `import` statements work without
 *   transpilation. All Jest globals (describe, test, expect, …) are injected
 *   automatically; no explicit import from '@jest/globals' is required.
 *
 * Mocking strategy:
 *   Most tests exercise the real bcrypt implementation to validate behaviour
 *   end-to-end. For error/edge cases that are hard to trigger through normal
 *   inputs (e.g. bcrypt internal failures) we use jest.unstable_mockModule to
 *   replace the 'bcrypt' module with a controlled fake.
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Import the module under test.
// This import will throw MODULE_NOT_FOUND until password.js is implemented,
// which is the expected RED state.
// ---------------------------------------------------------------------------

const { hashPassword, comparePassword } = await import(
  '../src/lib/password.js'
);

// ===========================================================================
// hashPassword()
// ===========================================================================

describe('hashPassword()', () => {
  // -------------------------------------------------------------------------
  // Happy-path
  // -------------------------------------------------------------------------

  test('should hash a valid password successfully', async () => {
    const hash = await hashPassword('secret123');

    expect(typeof hash).toBe('string');
    // bcrypt hashes always start with the cost-factor prefix
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  test('should return a string of bcrypt-typical length (≥ 60 characters)', async () => {
    const hash = await hashPassword('validPassword1');

    // Standard bcrypt output is 60 characters
    expect(hash.length).toBeGreaterThanOrEqual(60);
  });

  test('should return different hashes for the same password (salts differ)', async () => {
    const password = 'samePassword!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    // Bcrypt embeds a unique salt in every hash, so two calls must not collide
    expect(hash1).not.toBe(hash2);
  });

  test('should hash passwords that contain special characters', async () => {
    const specialPassword = '!@#$%^&*()_+-=[]{}|;\':",./<>?`~';
    const hash = await hashPassword(specialPassword);

    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  test('should hash a password that is exactly 6 characters (minimum boundary)', async () => {
    const hash = await hashPassword('abcdef');

    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  test('should hash a password that is exactly 128 characters (maximum boundary)', async () => {
    const maxPassword = 'a'.repeat(128);
    const hash = await hashPassword(maxPassword);

    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);
  });

  test('should hash a Unicode emoji password without truncation issues', async () => {
    // Each emoji is 2 UTF-16 code units but 4+ bytes in UTF-8.
    // Without SHA-256 pre-hashing a 10-emoji string could exceed 72 bytes
    // and cause bcrypt truncation. With pre-hashing all passwords are hashed
    // to a 64-byte hex digest before reaching bcrypt.
    const emojiPassword = '😀😁😂🤣😃😄😅😆'; // 8 emojis, length=16 in JS
    const hash = await hashPassword(emojiPassword);

    expect(typeof hash).toBe('string');
    expect(hash).toMatch(/^\$2[aby]\$\d{2}\$/);

    // Round-trip: should verify correctly
    const match = await comparePassword(emojiPassword, hash);
    expect(match).toBe(true);
  });

  // -------------------------------------------------------------------------
  // CRITICAL: bcrypt 72-byte truncation prevention
  // -------------------------------------------------------------------------

  test('should distinguish two passwords that share the same first 72 bytes', async () => {
    // Without SHA-256 pre-hashing, bcrypt would treat these two passwords as
    // identical because it silently truncates input to 72 bytes.
    const base = 'a'.repeat(72);
    const password1 = base + 'X'; // 73 chars
    const password2 = base + 'Y'; // 73 chars — differs only in byte 73

    // Both exceed MAX_PASSWORD_LENGTH (128)? No — 73 < 128, so they are valid.
    const hash1 = await hashPassword(password1);

    const matchSame = await comparePassword(password1, hash1);
    const matchDiff = await comparePassword(password2, hash1);

    expect(matchSame).toBe(true);
    expect(matchDiff).toBe(false); // Would be true without pre-hashing fix
  });

  // -------------------------------------------------------------------------
  // Validation — too short
  // -------------------------------------------------------------------------

  test('should reject a password shorter than 6 characters', async () => {
    await expect(hashPassword('abc')).rejects.toThrow();
  });

  test('should reject an empty string password', async () => {
    await expect(hashPassword('')).rejects.toThrow();
  });

  test('should reject a password of exactly 5 characters (one below minimum)', async () => {
    await expect(hashPassword('abcde')).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Validation — too long
  // -------------------------------------------------------------------------

  test('should reject a password longer than 128 characters', async () => {
    const tooLong = 'a'.repeat(129);
    await expect(hashPassword(tooLong)).rejects.toThrow();
  });

  test('should reject a password of exactly 129 characters (one above maximum)', async () => {
    const tooLong = 'x'.repeat(129);
    await expect(hashPassword(tooLong)).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Validation — error messages do not leak character count
  // -------------------------------------------------------------------------

  test('error message for too-short password should not contain character count', async () => {
    const shortPwd = 'abc';
    let errorMessage = '';
    try {
      await hashPassword(shortPwd);
    } catch (err) {
      errorMessage = err.message;
    }
    // Must NOT include "received N character(s)" — that leaks information
    expect(errorMessage).not.toMatch(/received \d+ character/);
    // Must still communicate the minimum length requirement
    expect(errorMessage).toMatch(/6/);
  });

  test('error message for too-long password should not contain character count', async () => {
    const longPwd = 'a'.repeat(129);
    let errorMessage = '';
    try {
      await hashPassword(longPwd);
    } catch (err) {
      errorMessage = err.message;
    }
    // Must NOT include "received N character(s)"
    expect(errorMessage).not.toMatch(/received \d+ character/);
    // Must still communicate the maximum length requirement
    expect(errorMessage).toMatch(/128/);
  });

  // -------------------------------------------------------------------------
  // Validation — null / undefined
  // -------------------------------------------------------------------------

  test('should reject a null password', async () => {
    await expect(hashPassword(null)).rejects.toThrow();
  });

  test('should reject an undefined password', async () => {
    await expect(hashPassword(undefined)).rejects.toThrow();
  });

  test('should reject a non-string password (number)', async () => {
    await expect(hashPassword(123456)).rejects.toThrow();
  });
});

// ===========================================================================
// comparePassword()
// ===========================================================================

describe('comparePassword()', () => {
  // Pre-compute a real bcrypt hash once for the happy-path suite so that
  // individual tests do not need to await hashing themselves.
  let validHash;

  beforeAll(async () => {
    validHash = await hashPassword('correctPassword1');
  });

  // -------------------------------------------------------------------------
  // Happy-path
  // -------------------------------------------------------------------------

  test('should return true when the password matches the hash', async () => {
    const result = await comparePassword('correctPassword1', validHash);

    expect(result).toBe(true);
  });

  test('should return false when the password does not match the hash', async () => {
    const result = await comparePassword('wrongPassword!', validHash);

    expect(result).toBe(false);
  });

  test('should throw for an empty string password (mirrors hashPassword behavior)', async () => {
    await expect(comparePassword('', validHash)).rejects.toThrow(
      'Password must not be empty',
    );
  });

  test('should handle bcrypt hash format correctly (hash starting with $2b$)', async () => {
    // Ensure the pre-computed hash has the expected bcrypt format
    expect(validHash).toMatch(/^\$2[aby]\$10\$/);

    const result = await comparePassword('correctPassword1', validHash);

    expect(result).toBe(true);
  });

  test('should be case-sensitive when comparing passwords', async () => {
    const hash = await hashPassword('CaseSensitive1');

    const upperResult = await comparePassword('CASESENSITIVE1', hash);
    const lowerResult = await comparePassword('casesensitive1', hash);
    const exactResult = await comparePassword('CaseSensitive1', hash);

    expect(upperResult).toBe(false);
    expect(lowerResult).toBe(false);
    expect(exactResult).toBe(true);
  });

  test('should return false for a password that differs by only one character', async () => {
    const hash = await hashPassword('password123');

    const result = await comparePassword('password124', hash);

    expect(result).toBe(false);
  });

  // -------------------------------------------------------------------------
  // HIGH: DoS length guard — oversized passwords return false, do not throw
  // -------------------------------------------------------------------------

  test('should return false (not throw) for a password longer than MAX_PASSWORD_LENGTH', async () => {
    const oversized = 'a'.repeat(129);

    // Must not throw — throwing would distinguish "too long" from "wrong password"
    const result = await comparePassword(oversized, validHash);
    expect(result).toBe(false);
  });

  test('should return false (not throw) for an extremely long password (DoS guard)', async () => {
    const extremelyLong = 'x'.repeat(10_000);

    const result = await comparePassword(extremelyLong, validHash);
    expect(result).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Invalid hash format
  // -------------------------------------------------------------------------

  test('should reject an invalid hash format (plain string, not bcrypt)', async () => {
    await expect(
      comparePassword('anyPassword1', 'not-a-bcrypt-hash'),
    ).rejects.toThrow();
  });

  test('should reject an empty string as hash', async () => {
    await expect(comparePassword('anyPassword1', '')).rejects.toThrow();
  });

  // -------------------------------------------------------------------------
  // Null / undefined inputs
  // -------------------------------------------------------------------------

  test('should reject null as the password argument', async () => {
    await expect(comparePassword(null, validHash)).rejects.toThrow();
  });

  test('should reject undefined as the password argument', async () => {
    await expect(comparePassword(undefined, validHash)).rejects.toThrow();
  });

  test('should reject null as the hash argument', async () => {
    await expect(comparePassword('anyPassword1', null)).rejects.toThrow();
  });

  test('should reject undefined as the hash argument', async () => {
    await expect(comparePassword('anyPassword1', undefined)).rejects.toThrow();
  });

  test('should reject when both arguments are null', async () => {
    await expect(comparePassword(null, null)).rejects.toThrow();
  });
});
