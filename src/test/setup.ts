import '@testing-library/jest-dom/vitest';

// jsdom lacks crypto.subtle; stub it so sha256Hex works in tests.
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
  });
}
