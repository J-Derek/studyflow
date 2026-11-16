import { describe, expect, it } from 'vitest';
import { applyFormat } from './markdownEdit';

describe('bold and italic', () => {
  it('wrap the selection and keep it selected', () => {
    expect(applyFormat('make this loud', 5, 9, 'bold')).toEqual({ text: 'make **this** loud', start: 7, end: 11 });
    expect(applyFormat('make this loud', 5, 9, 'italic')).toEqual({ text: 'make *this* loud', start: 6, end: 10 });
  });
  it('insert a placeholder when nothing is selected', () => {
    expect(applyFormat('a b', 1, 1, 'bold')).toEqual({ text: 'a**bold text** b', start: 3, end: 12 });
  });
  it('take the marks off when pressed again', () => {
    expect(applyFormat('**this**', 0, 8, 'bold')).toEqual({ text: 'this', start: 0, end: 4 });
  });
  // Derek's report: the Bold button left "****" behind. Pressing it again must undo it, never nest more marks.
  it('take the marks off when pressed again with only the words inside selected (as the button leaves them)', () => {
    expect(applyFormat('a **word** b', 4, 8, 'bold')).toEqual({ text: 'a word b', start: 2, end: 6 });
    expect(applyFormat('a *word* b', 3, 7, 'italic')).toEqual({ text: 'a word b', start: 2, end: 6 });
  });
  it('take a placeholder that was never typed over away completely when pressed again', () => {
    expect(applyFormat('Intro **bold text**', 8, 17, 'bold')).toEqual({ text: 'Intro ', start: 6, end: 6 });
    expect(applyFormat('*italic text*', 1, 12, 'italic')).toEqual({ text: '', start: 0, end: 0 });
  });
  it('remove empty marks the cursor sits between, instead of adding more', () => {
    expect(applyFormat('a****b', 3, 3, 'bold')).toEqual({ text: 'ab', start: 1, end: 1 });
    expect(applyFormat('a**b', 2, 2, 'italic')).toEqual({ text: 'ab', start: 1, end: 1 });
  });
  it('step out of bold or italic when pressed at the end of the words just typed, so the next words are plain', () => {
    expect(applyFormat('Intro **key point**', 17, 17, 'bold')).toEqual({ text: 'Intro **key point**', start: 19, end: 19 });
    expect(applyFormat('an *idea* here', 8, 8, 'italic')).toEqual({ text: 'an *idea* here', start: 9, end: 9 });
  });
  it('tell bold and italic marks apart', () => {
    // italic on a bold word adds italic; it does not mistake one of the bold stars for an italic one
    expect(applyFormat('**word**', 2, 6, 'italic')).toEqual({ text: '***word***', start: 3, end: 7 });
    expect(applyFormat('**word**', 0, 8, 'italic')).toEqual({ text: '***word***', start: 1, end: 9 });
    // and each button takes off only its own marks
    expect(applyFormat('***word***', 3, 7, 'bold')).toEqual({ text: '*word*', start: 1, end: 5 });
    expect(applyFormat('***word***', 3, 7, 'italic')).toEqual({ text: '**word**', start: 2, end: 6 });
  });
});

describe('line formats', () => {
  it('turn a line into a heading and back', () => {
    expect(applyFormat('Title', 2, 2, 'heading').text).toBe('## Title');
    expect(applyFormat('## Title', 3, 3, 'heading').text).toBe('Title');
  });
  it('turn every selected line into list items, and back', () => {
    const t = 'one\ntwo\nthree';
    expect(applyFormat(t, 0, t.length, 'bullet').text).toBe('- one\n- two\n- three');
    expect(applyFormat('- one\n- two', 0, 11, 'bullet').text).toBe('one\ntwo');
    expect(applyFormat(t, 0, t.length, 'numbered').text).toBe('1. one\n2. two\n3. three');
    expect(applyFormat('1. one\n2. two', 0, 13, 'numbered').text).toBe('one\ntwo');
  });
  it('only touch the lines the selection reaches, and swap one list kind for the other', () => {
    expect(applyFormat('keep\nchange me\nkeep too', 6, 8, 'bullet').text).toBe('keep\n- change me\nkeep too');
    expect(applyFormat('- a\n- b', 0, 7, 'numbered').text).toBe('1. a\n2. b');
  });
});
