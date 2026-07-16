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

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'crypto';
import { promisify } from 'util';

// ── Human passwords (Phase 7.13a) ─────────────────────────────────────────────
//
// This is the ONLY place in the codebase where a human-chosen secret is stored, and it is the one
// place a slow hash belongs. Everywhere else — session tokens, admin API tokens, team keys, recovery
// codes — the secret is a high-entropy value WE generated, and sha256 is correct there: those are
// unguessable regardless, and a fast digest is what makes verification an O(1) indexed lookup.
// A password is the opposite: chosen by a person, drawn from a small space, and worth guessing.
//
// scrypt, from Node's own crypto, rather than bcrypt or argon2:
//   - It is memory-hard, which is the property that defeats GPU and ASIC guessing. bcrypt is not.
//   - It ships with Node. No new dependency to audit, no native module to compile in the Docker
//     build, and nothing added to the supply chain for the sake of one function.
//   - OWASP lists it as an acceptable choice where argon2id is unavailable.
//
// Always async. A sync scrypt at these parameters blocks the event loop for ~100ms, which would
// stall every in-flight proxy request on the same process — and would show up as a spike in the
// event-loop lag the Health tab measures.

// `scrypt` is overloaded, and promisify resolves to the overload WITHOUT options — which would
// silently use Node's defaults (N=16384) instead of the parameters chosen below. The cast pins the
// signature that takes them.
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

// N=2^15, r=8, p=1 → ~32 MB and ~100 ms per hash on a modern core. The cost is paid on sign-in
// only (never on the proxy hot path), and sign-in is rate-limited and lockout-guarded on top.
const N = 32768;
const R = 8;
const P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

// scrypt's memory cost is 128 * N * r bytes. Node caps scrypt's allocation at 32 MB by default and
// throws above it, so the limit is raised to match the parameters rather than tuning them down.
const MAX_MEM = 256 * N * R;

/** The algorithm tag stored with every digest, so a future migration to argon2 can tell them apart. */
const ALGO = 'scrypt';

/**
 * Minimum password length. NIST SP 800-63B: length is what carries entropy, and composition rules
 * ("one capital, one symbol") measurably push people toward predictable patterns like "Password1!".
 * So: a real floor, and no theatre on top of it.
 */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * Upper bound. Not a security limit — a defence against a megabyte "password" being fed into a
 * deliberately expensive hash as a cheap way to burn the gateway's CPU.
 */
export const MAX_PASSWORD_LENGTH = 200;

/** Why a password was rejected, in words a person can act on — or null when it is acceptable. */
export function passwordProblem(password: string): string | null {
  if (typeof password !== 'string' || password.length === 0) return 'Enter a password.';
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters. Length is what makes a password hard to guess — a long phrase beats a short, complicated one.`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) return `Keep it under ${MAX_PASSWORD_LENGTH} characters.`;
  return null;
}

/**
 * Hash a password for storage. Every call mints a fresh random salt, so two people who choose the
 * same password store different digests and neither is revealed by the other.
 *
 * Encoded as `scrypt$N$r$p$salt$hash` — the parameters travel WITH the digest, so raising the cost
 * later does not invalidate existing passwords: an old digest still verifies against its own
 * recorded parameters. A bare hash with the cost held in code could never be upgraded.
 */
export async function hashPassword(password: string): Promise<string> {
  const problem = passwordProblem(password);
  if (problem) throw new Error(problem);

  const salt = randomBytes(SALT_LEN);
  const derived = await scryptAsync(password, salt, KEY_LEN, { N, r: R, p: P, maxmem: MAX_MEM });
  return [ALGO, N, R, P, salt.toString('hex'), derived.toString('hex')].join('$');
}

/**
 * Verify a password against a stored digest, in constant time.
 *
 * Never throws: an unparseable, empty, or foreign-format digest is a failed verification, not a 500.
 * A stored value we cannot read must deny access rather than crash the sign-in route — and a null
 * digest (an SSO account, which has no local password) must always fail, which is the whole
 * mechanism preventing an SSO user from signing in with a password.
 */
export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored || !password) return false;

  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== ALGO) return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  // Guard the parameters read back from the database before handing them to scrypt: a corrupted or
  // tampered row must not be able to demand a gigabyte of memory, and a zero would make scrypt throw.
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
  if (n < 2 || r < 1 || p < 1 || 128 * n * r > MAX_MEM) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], 'hex');
    expected = Buffer.from(parts[5], 'hex');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const derived = await scryptAsync(password, salt, expected.length, { N: n, r, p, maxmem: MAX_MEM });
    // Both buffers are derived to the same length by construction, so timingSafeEqual cannot throw
    // here — and the comparison stays constant-time, which a `===` on hex strings would not be.
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * True when a stored value is a digest this module produced.
 *
 * Exists so a test can assert that what lands in the database is a real slow hash. Our CodeQL config
 * excludes `js/insufficient-password-hash` — correctly, because it fires on the sha256 digests we
 * use for high-entropy tokens — which means the scanner will not catch a password that regresses to
 * a fast hash. This function is how that guarantee is held by our own gate instead.
 */
export function isPasswordHash(stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  return parts.length === 6 && parts[0] === ALGO && /^[0-9a-f]+$/.test(parts[5]);
}

/**
 * A recovery key: 128 bits, formatted in readable groups. Resets a forgotten PASSWORD — distinct
 * from the recovery codes that substitute for a lost AUTHENTICATOR.
 *
 * Stored as a sha256 digest (see adminUsers.service), not scrypt, and that is deliberate: this is a
 * value we generate at full entropy, not one a person chose, so it is unguessable regardless and the
 * fast digest keeps the lookup indexed. Same reasoning as recovery codes and API tokens.
 */
export function generateRecoveryKey(): string {
  const hex = randomBytes(16).toString('hex'); // 32 hex chars = 128 bits
  return (hex.match(/.{1,4}/g) ?? []).join('-');
}
