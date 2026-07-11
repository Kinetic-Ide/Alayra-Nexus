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
  normalizeNotificationConfig, keyBannedMessage, breakerOpenedMessage, adminLockoutMessage,
  coalesceRedisKey, DEFAULT_WINDOW_SECONDS, MIN_WINDOW_SECONDS, NOTIFY_EVENTS,
} from './notify';

describe('normalizeNotificationConfig', () => {
  it('defaults an empty/absent config to off with every event on', () => {
    const c = normalizeNotificationConfig(null);
    expect(c.enabled).toBe(false);
    expect(c.resendApiKey).toBe('');
    expect(c.to).toEqual([]);
    expect(c.windowSeconds).toBe(DEFAULT_WINDOW_SECONDS);
    for (const e of NOTIFY_EVENTS) expect(c.events[e]).toBe(true);
  });

  it('clamps the window to the floor and trims/filters recipients', () => {
    const c = normalizeNotificationConfig({ windowSeconds: 5, to: [' a@b.com ', '', 'c@d.com'] });
    expect(c.windowSeconds).toBe(MIN_WINDOW_SECONDS);
    expect(c.to).toEqual(['a@b.com', 'c@d.com']);
  });

  it('treats a missing event flag as on but an explicit false as off', () => {
    const c = normalizeNotificationConfig({ events: { keyBanned: false } });
    expect(c.events.keyBanned).toBe(false);
    expect(c.events.breakerOpened).toBe(true); // absent → on
  });

  it('coerces junk types without throwing', () => {
    const c = normalizeNotificationConfig({ enabled: 'yes', to: 'nope', from: 42, windowSeconds: 'x' });
    expect(c.enabled).toBe(false);       // only boolean true enables
    expect(c.to).toEqual([]);
    expect(c.from).toBe('');
    expect(c.windowSeconds).toBe(DEFAULT_WINDOW_SECONDS);
  });
});

describe('message builders', () => {
  it('build a typed message with a stable, occurrence-scoped dedupe key', () => {
    const banned = keyBannedMessage('openai', '●●●●1234');
    expect(banned.type).toBe('keyBanned');
    expect(banned.dedupeKey).toBe('keyBanned:openai:●●●●1234');
    expect(banned.title).toContain('openai');

    const opened = breakerOpenedMessage('groq', '●●●●abcd', 30);
    expect(opened.type).toBe('breakerOpened');
    expect(opened.dedupeKey).toBe('breakerOpened:groq:●●●●abcd');
    expect(opened.body).toContain('30s');

    const lock = adminLockoutMessage('203.0.113.7');
    expect(lock.type).toBe('adminLockout');
    expect(lock.dedupeKey).toBe('adminLockout:203.0.113.7');
  });

  it('namespaces the coalesce Redis key', () => {
    expect(coalesceRedisKey('keyBanned:openai:x')).toBe('nexus:notify:sent:keyBanned:openai:x');
  });
});
