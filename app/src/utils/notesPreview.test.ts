import { describe, expect, it } from 'vitest';
import { notesPreview } from './notesPreview';

describe('notesPreview', () => {
  it('drops headings, bold, italic and list marks', () => {
    expect(notesPreview('## Offer\n\nAn **offer** must be _clear_.\n- one\n1. two')).toBe('Offer\n\nAn offer must be clear.\none\ntwo');
  });
  it('is empty for empty notes and short for long ones', () => {
    expect(notesPreview('   ')).toBe('');
    expect(notesPreview('a'.repeat(500))).toHaveLength(200);
  });
});
