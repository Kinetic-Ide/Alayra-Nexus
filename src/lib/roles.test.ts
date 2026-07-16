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
import { asRole, roleAtLeast, canWrite, ROLE_LABELS, type AdminRole } from './roles';

describe('asRole', () => {
  it('reads the three roles back', () => {
    expect(asRole('owner')).toBe('owner');
    expect(asRole('admin')).toBe('admin');
    expect(asRole('viewer')).toBe('viewer');
  });

  it('resolves an unrecognised or legacy value to owner', () => {
    // A pre-6.5 session was the literal string '1'. Failing closed here would demote every existing
    // operator the moment they upgraded.
    expect(asRole('1')).toBe('owner');
    expect(asRole(null)).toBe('owner');
    expect(asRole(undefined)).toBe('owner');
    expect(asRole('nonsense')).toBe('owner');
  });
});

describe('roleAtLeast', () => {
  it('ranks owner above admin above viewer', () => {
    expect(roleAtLeast('owner', 'owner')).toBe(true);
    expect(roleAtLeast('owner', 'admin')).toBe(true);
    expect(roleAtLeast('owner', 'viewer')).toBe(true);

    expect(roleAtLeast('admin', 'owner')).toBe(false);
    expect(roleAtLeast('admin', 'admin')).toBe(true);
    expect(roleAtLeast('admin', 'viewer')).toBe(true);

    expect(roleAtLeast('viewer', 'owner')).toBe(false);
    expect(roleAtLeast('viewer', 'admin')).toBe(false);
    expect(roleAtLeast('viewer', 'viewer')).toBe(true);
  });
});

describe('canWrite', () => {
  it('is exactly "not a viewer"', () => {
    expect(canWrite('owner')).toBe(true);
    expect(canWrite('admin')).toBe(true);
    expect(canWrite('viewer')).toBe(false);
  });
});

describe('ROLE_LABELS', () => {
  it('names every role, so no role can reach the UI unexplained', () => {
    for (const role of ['owner', 'admin', 'viewer'] as AdminRole[]) {
      expect(ROLE_LABELS[role].label.length).toBeGreaterThan(0);
      expect(ROLE_LABELS[role].description.length).toBeGreaterThan(0);
    }
  });
});
