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

import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL?.trim();
if (!REDIS_URL) throw new Error('FATAL: REDIS_URL is not set');

export const redis = new Redis(REDIS_URL);

// ── Error logging ─────────────────────────────────────────────────────────────
// ioredis emits an `error` per reconnection attempt. Logging the full object each
// time buries the one line an operator needs under twenty identical stack traces.
// Log the first occurrence, then collapse repeats into a periodic count.
const ERROR_LOG_INTERVAL_MS = 30_000;
let lastLoggedAt = 0;
let suppressedCount = 0;
let silenced = 0;

/**
 * Silence the reconnection log while a caller is deliberately probing the
 * connection (see services/preflight.service.ts) and wants to print its own
 * message. Returns the function that restores logging. Re-entrant.
 */
export function suppressRedisErrorLog(): () => void {
  silenced++;
  return () => { silenced = Math.max(0, silenced - 1); };
}

redis.on('error', (err: Error & { code?: string }) => {
  if (silenced) return;
  const now = Date.now();
  if (now - lastLoggedAt < ERROR_LOG_INTERVAL_MS) { suppressedCount++; return; }
  const repeats = suppressedCount ? ` (${suppressedCount} more since last message)` : '';
  lastLoggedAt = now;
  suppressedCount = 0;
  console.error(`Redis ${err.code ?? 'error'}: ${err.message}${repeats}`);
});

export async function setWithExpiry(key: string, value: string, ttlSeconds: number): Promise<void> {
  await redis.set(key, value, 'EX', ttlSeconds);
}

export async function getAndDelete(key: string): Promise<string | null> {
  // Use pipeline for atomicity
  const multi = redis.multi();
  multi.get(key);
  multi.del(key);
  
  const results = await multi.exec();
  
  if (!results || results.length === 0) return null;
  
  // Results array structure: [[error, valueForGet], [error, valueForDel]]
  const [getError, value] = results[0];
  if (getError) {
    console.error('Redis multi GET error', getError);
    return null;
  }
  
  return typeof value === 'string' ? value : null;
}

export async function increment(key: string): Promise<number> {
  return await redis.incr(key);
}

export async function setExpiry(key: string, ttlSeconds: number): Promise<void> {
  await redis.expire(key, ttlSeconds);
}
