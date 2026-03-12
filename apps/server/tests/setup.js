/**
 * Jest setup file.
 *
 * Exposes the `jest` object as a global so tests can call `jest.fn()`,
 * `jest.spyOn()`, etc. without importing from `@jest/globals`.
 *
 * With Jest 30 and --experimental-vm-modules, the `jest` global is not
 * automatically injected into ESM module scopes. We import it from
 * @jest/globals and expose it on globalThis.
 */

import { jest } from '@jest/globals';

globalThis.jest = jest;
