import { describe, it, expect, beforeEach } from 'vitest';
import { syncThemeColor } from './themeColor';
import type { DocumentLike } from './themeColor';

describe('syncThemeColor', () => {
  let mockMetas: Array<{ name: string; content: string; remove: () => void }>;
  let mockDoc: DocumentLike;

  beforeEach(() => {
    mockMetas = [];
    mockDoc = {
      querySelectorAll: (selector: string) => {
        if (selector === 'meta[name="theme-color"]') {
          return [...mockMetas];
        }
        return [];
      },
      createElement: (_tag: string) => {
        const el = {
          name: '',
          content: '',
          remove: () => {
            const idx = mockMetas.indexOf(el);
            if (idx !== -1) mockMetas.splice(idx, 1);
          }
        };
        return el;
      },
      head: {
        appendChild: (el: any) => {
          mockMetas.push(el);
        }
      }
    };
  });

  it('sets dark theme color #090A0C when dark is true', () => {
    syncThemeColor(true, mockDoc);
    expect(mockMetas.length).toBe(1);
    expect(mockMetas[0].name).toBe('theme-color');
    expect(mockMetas[0].content).toBe('#090A0C');
  });

  it('sets light theme color #F8F9FA when dark is false', () => {
    syncThemeColor(false, mockDoc);
    expect(mockMetas.length).toBe(1);
    expect(mockMetas[0].name).toBe('theme-color');
    expect(mockMetas[0].content).toBe('#F8F9FA');
  });

  it('purges preexisting theme-color tags before injecting new one', () => {
    // Add two preexisting tags
    mockMetas.push(
      { name: 'theme-color', content: '#111', remove: () => {} },
      { name: 'theme-color', content: '#222', remove: () => {} }
    );
    // Wire remove behavior
    mockMetas[0].remove = () => { mockMetas.splice(mockMetas.indexOf(mockMetas[0]), 1); };
    mockMetas[1].remove = () => { mockMetas.splice(mockMetas.indexOf(mockMetas[1]), 1); };

    expect(mockMetas.length).toBe(2);

    syncThemeColor(true, mockDoc);
    expect(mockMetas.length).toBe(1);
    expect(mockMetas[0].content).toBe('#090A0C');
  });

  it('safely handles null document (SSR / non-browser)', () => {
    expect(() => syncThemeColor(true, null)).not.toThrow();
  });
});
