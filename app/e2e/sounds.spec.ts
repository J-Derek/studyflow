import { expect, test } from '@playwright/test';

type S = {
  setSoundscape: (id: string, mode: 'focus' | 'break') => void;
  setTimerMode: (m: string) => void;
  startTimer: () => void;
  resetTimer: () => void;
  userId: string | null;
};

// Measures what the speakers would get: loud enough to hear, never loud enough to startle, and
// not harsh. A high "spectral centroid" is the mark of hissy, piercing sound.
const IDS = ['rain', 'waves', 'pad', 'keys', 'brown', 'breeze', 'chimes'] as const;

for (const id of IDS) {
  test(`sound "${id}" is audible, soft and not harsh`, async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as Record<string, unknown>;
      const Orig = window.AudioContext;
      const origConnect = AudioNode.prototype.connect as (...a: unknown[]) => unknown;
      window.AudioContext = class extends Orig {
        constructor(...a: ConstructorParameters<typeof AudioContext>) {
          super(...a);
          const an = this.createAnalyser();
          an.fftSize = 2048;
          an.smoothingTimeConstant = 0;
          w.__an = an;
        }
      } as typeof AudioContext;
      AudioNode.prototype.connect = function (this: AudioNode, dest: unknown, ...rest: unknown[]) {
        if (dest === this.context.destination && w.__an) origConnect.call(this, w.__an);
        return origConnect.call(this, dest, ...rest);
      } as typeof AudioNode.prototype.connect;
    });
    await page.goto('/timer');
    await page.waitForFunction(() => !!(window as unknown as { __store?: { getState: () => S } }).__store?.getState().userId);

    const result = await page.evaluate(
      async ({ id }) => {
        const store = (window as unknown as { __store: { getState: () => S } }).__store;
        const s = store.getState();
        s.setTimerMode('focus');
        s.setSoundscape(id, 'focus');
        store.getState().startTimer();
        await new Promise((r) => setTimeout(r, 400));
        const an = (window as unknown as { __an: AnalyserNode }).__an;
        const time = new Float32Array(an.fftSize);
        const freq = new Float32Array(an.frequencyBinCount);
        const sampleRate = an.context.sampleRate;
        let peak = 0;
        let rmsSum = 0;
        let rmsCount = 0;
        let maxWindowPeak = 0;
        let centroidSum = 0;
        let centroidCount = 0;
        const start = performance.now();
        while (performance.now() - start < 9000) {
          an.getFloatTimeDomainData(time);
          let sq = 0;
          let p = 0;
          for (const v of time) {
            sq += v * v;
            p = Math.max(p, Math.abs(v));
          }
          peak = Math.max(peak, p);
          maxWindowPeak = Math.max(maxWindowPeak, p);
          if (performance.now() - start > 5000) {
            rmsSum += Math.sqrt(sq / time.length);
            rmsCount += 1;
            an.getFloatFrequencyData(freq);
            let num = 0;
            let den = 0;
            for (let i = 1; i < freq.length; i++) {
              const mag = Math.pow(10, freq[i]! / 20);
              num += mag * ((i * sampleRate) / an.fftSize);
              den += mag;
            }
            if (den > 1e-6) {
              centroidSum += num / den;
              centroidCount += 1;
            }
          }
          await new Promise((r) => setTimeout(r, 50));
        }
        store.getState().resetTimer();
        return { peak, rms: rmsSum / Math.max(1, rmsCount), maxWindowPeak, centroid: centroidSum / Math.max(1, centroidCount) };
      },
      { id }
    );

    console.log(id, JSON.stringify(result));
    expect(result.peak, 'never loud enough to startle').toBeLessThan(0.5);
    expect(result.maxWindowPeak, 'audible').toBeGreaterThan(0.01);
    if (['rain', 'waves', 'brown', 'breeze', 'pad'].includes(id)) expect(result.rms, 'steady sounds stay present').toBeGreaterThan(0.002);
    expect(result.centroid, 'not harsh or hissy').toBeLessThan(3200);
  });
}
