/*
 * Copyright (c) 2026 Alayra Systems Pvt. Limited (Pakistan)
 * & Alayra Systems LLC (USA).
 *
 * Alayra Nexus™ is a trademark of Alayra Systems. Use of the name or logo
 * is not granted by the software license below.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * A copy of the License is in the LICENSE file at the repository root,
 * or at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF
 * ANY KIND, either express or implied. See the License for details.
 */

import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  isPasswordHash,
  passwordProblem,
  generateRecoveryKey,
  MIN_PASSWORD_LENGTH,
} from './password';

const GOOD = 'correct horse battery staple';

describe('hashPassword / verifyPassword', () => {
  it('accepts the right password and refuses a wrong one', async () => {
    const stored = await hashPassword(GOOD);
    expect(await verifyPassword(GOOD, stored)).toBe(true);
    expect(await verifyPassword(GOOD + 'x', stored)).toBe(false);
    expect(await verifyPassword('', stored)).toBe(false);
  });

  it('salts every hash, so the same password stored twice looks different', async () => {
    const a = await hashPassword(GOOD);
    const b = await hashPassword(GOOD);
    expect(a).not.toBe(b);
    // ...and both still verify: the salt travels with the digest.
    expect(await verifyPassword(GOOD, a)).toBe(true);
    expect(await verifyPassword(GOOD, b)).toBe(true);
  });

  it('stores the cost parameters with the digest, so the cost can be raised later', async () => {
    const stored = await hashPassword(GOOD);
    const [algo, n, r, p, salt, hash] = stored.split('$');
    expect(algo).toBe('scrypt');
    expect(Number(n)).toBeGreaterThanOrEqual(16384);
    expect(Number(r)).toBeGreaterThanOrEqual(8);
    expect(Number(p)).toBeGreaterThanOrEqual(1);
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
    expect(hash).toMatch(/^[0-9a-f]{128}$/);
  });

  it('verifies a digest written at a DIFFERENT cost than the current default', async () => {
    // Proves the parameters are read from the row rather than assumed from code — the property that
    // lets the cost be raised without invalidating everyone's existing password.
    const cheap = 'scrypt$16384$8$1$' + 'ab'.repeat(16) + '$';
    const { scrypt } = await import('crypto');
    const { promisify } = await import('util');
    const derived = (await promisify(scrypt)(GOOD, Buffer.from('ab'.repeat(16), 'hex'), 64, {
      N: 16384, r: 8, p: 1, maxmem: 256 * 32768 * 8,
    })) as Buffer;
    const stored = cheap + derived.toString('hex');
    expect(await verifyPassword(GOOD, stored)).toBe(true);
    expect(await verifyPassword('wrong password here', stored)).toBe(false);
  });
});

describe('verifyPassword — never throws, always denies', () => {
  it('refuses a null digest, which is how an SSO account is barred from password sign-in', async () => {
    // An SSO-provisioned user has passwordHash = null. If this ever returned true, an account that
    // was never given a local password could be signed into with one.
    expect(await verifyPassword(GOOD, null)).toBe(false);
    expect(await verifyPassword(GOOD, undefined)).toBe(false);
    expect(await verifyPassword(GOOD, '')).toBe(false);
  });

  it('refuses a corrupt, foreign, or tampered digest instead of crashing sign-in', async () => {
    for (const bad of [
      'not-a-hash',
      'scrypt$32768$8$1$onlyfivefields',
      '$2b$12$abcdefghijklmnopqrstuv', // a bcrypt hash from some other system
      'scrypt$0$8$1$aabb$ccdd',        // N below the floor
      'scrypt$99999999$8$1$aabb$ccdd', // a memory bomb: 128*N*r far past the cap
      'scrypt$32768$8$1$$',            // empty salt and hash
      'scrypt$abc$8$1$aabb$ccdd',      // non-numeric cost
    ]) {
      expect(await verifyPassword(GOOD, bad)).toBe(false);
    }
  });
});

describe('isPasswordHash — our own gate against a fast-hash regression', () => {
  it('recognises a real scrypt digest', async () => {
    expect(isPasswordHash(await hashPassword(GOOD))).toBe(true);
  });

  it('rejects a bare sha256 digest of the password', async () => {
    // The regression this guards: CodeQL's password-hash rule is excluded in our config (it fires on
    // the sha256 digests we use for high-entropy TOKENS, where it is wrong), so the scanner would not
    // catch a password quietly downgraded to a fast hash. This assertion would.
    const { createHash } = await import('crypto');
    const sha = createHash('sha256').update(GOOD).digest('hex');
    expect(isPasswordHash(sha)).toBe(false);
    expect(isPasswordHash(null)).toBe(false);
  });
});

describe('passwordProblem', () => {
  it('demands length rather than composition theatre', () => {
    expect(passwordProblem('short')).toContain(String(MIN_PASSWORD_LENGTH));
    expect(passwordProblem('')).toBe('Enter a password.');
    // No capital, no digit, no symbol — and correctly accepted. Composition rules push people toward
    // predictable patterns; length is what actually carries entropy (NIST SP 800-63B).
    expect(passwordProblem('the quick brown fox jumps')).toBeNull();
    expect(passwordProblem('x'.repeat(201))).toContain('200');
  });

  it('refuses to hash a password that fails the policy', async () => {
    await expect(hashPassword('short')).rejects.toThrow(/at least 12/);
  });
});

describe('generateRecoveryKey', () => {
  it('mints a readable 128-bit key, different every time', () => {
    const a = generateRecoveryKey();
    expect(a).toMatch(/^([0-9a-f]{4}-){7}[0-9a-f]{4}$/);
    expect(a.replace(/-/g, '')).toHaveLength(32); // 128 bits
    expect(new Set(Array.from({ length: 50 }, generateRecoveryKey)).size).toBe(50);
  });
});
