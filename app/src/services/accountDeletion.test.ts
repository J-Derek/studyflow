/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const rules = readFileSync(new URL('../../../firestore.rules', import.meta.url), 'utf8');

describe('account deletion covers every collection in firestore.rules', () => {
  it('lists each match /users/{userId}/<collection>/{id} in the deletion list', async () => {
    // The deletion module needs Firebase; read its list as text so this test needs no emulator.
    const source = readFileSync(new URL('./accountDeletion.ts', import.meta.url), 'utf8');
    const listed = new Set<string>([...source.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]));
    const inRules = [...rules.matchAll(/match \/([A-Za-z]+)\/\{[A-Za-z]+\}/g)].map((m) => m[1]).filter((name) => name !== 'users' && name !== 'databases');
    expect(inRules.length).toBeGreaterThan(3);
    for (const name of inRules) {
      expect(listed.has(name), `"${name}" is in firestore.rules but not in the account deletion list (src/services/accountDeletion.ts)`).toBe(true);
    }
  });
});
