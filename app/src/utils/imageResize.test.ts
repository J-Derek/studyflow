import { describe, expect, it } from 'vitest';
import { cropBox } from './imageResize';

describe('cropBox', () => {
  it('takes the centred square from a wide picture', () => {
    expect(cropBox(400, 200)).toEqual({ sx: 100, sy: 0, side: 200 });
  });
  it('takes the centred square from a tall picture', () => {
    expect(cropBox(200, 500)).toEqual({ sx: 0, sy: 150, side: 200 });
  });
  it('keeps a square picture whole', () => {
    expect(cropBox(300, 300)).toEqual({ sx: 0, sy: 0, side: 300 });
  });
  it('never returns a zero-size box', () => {
    expect(cropBox(0, 0).side).toBe(1);
  });
});
