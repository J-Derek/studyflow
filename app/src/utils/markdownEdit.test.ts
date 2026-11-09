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
