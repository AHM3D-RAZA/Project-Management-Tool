import { describe, expect, it } from 'vitest';
import { getAdminUserIds, getMemberUserIds } from '@/lib/member-sync';

describe('getMemberUserIds', () => {
  it('returns every uid in memberRoles', () => {
    const ws = { memberRoles: { u1: 'owner' as const, u2: 'member' as const, u3: 'lead' as const } };
    expect(getMemberUserIds(ws)).toEqual(['u1', 'u2', 'u3']);
  });

  it('returns an empty array for a null/undefined workspace', () => {
    expect(getMemberUserIds(null)).toEqual([]);
    expect(getMemberUserIds(undefined)).toEqual([]);
  });

  it('returns an empty array when memberRoles is missing', () => {
    expect(getMemberUserIds({ memberRoles: undefined as never })).toEqual([]);
  });
});

describe('getAdminUserIds', () => {
  it('includes only owners and leads, not members', () => {
    const ws = { memberRoles: { u1: 'owner' as const, u2: 'member' as const, u3: 'lead' as const } };
    expect(getAdminUserIds(ws)).toEqual(['u1', 'u3']);
  });

  it('returns an empty array for a null/undefined workspace', () => {
    expect(getAdminUserIds(null)).toEqual([]);
    expect(getAdminUserIds(undefined)).toEqual([]);
  });
});
