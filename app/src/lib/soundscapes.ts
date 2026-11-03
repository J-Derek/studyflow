import type { SoundscapeType } from '../types';

let audioCtx: AudioContext | null = null;
let activeNodes: AudioNode[] = [];
let gainNode: GainNode | null = null;
let activeSoundscape: SoundscapeType = 'off';
const noiseBufferCache = new Map<'pink' | 'brown' | 'white', AudioBuffer>();

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Creates or retrieves 5 seconds of looped audio buffer for ambient noise (cached to prevent CPU spikes)
 */
function createNoiseBuffer(ctx: AudioContext, type: 'pink' | 'brown' | 'white'): AudioBuffer {
  if (noiseBufferCache.has(type)) {
    return noiseBufferCache.get(type)!;
  }

  const bufferSize = ctx.sampleRate * 5;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else if (type === 'pink') {
    // Paul Kellet's refined filter method for pink noise
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else if (type === 'brown') {
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Gain compensation
    }
  }

  noiseBufferCache.set(type, buffer);
  return buffer;
}

function fadeTo(g: GainNode, c: AudioContext, target: number, tc = 0.08): void {
  const t = c.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
  g.gain.setTargetAtTime(target, t, tc);
}

export function playSoundscape(type: SoundscapeType, volume: number = 0.3): void {
  stopSoundscape();
  if (type === 'off') {
    activeSoundscape = 'off';
    return;
  }

  try {
    const ctx = getAudioContext();
    const targetVolume = Math.max(0.01, Math.min(1, volume));
    gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.0001, ctx.currentTime);
    fadeTo(gainNode, ctx, targetVolume, 0.06);
    gainNode.connect(ctx.destination);

    if (type === 'rain') {
      const buffer = createNoiseBuffer(ctx, 'pink');
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      // Filter for gentle rain frequency
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, ctx.currentTime);

      source.connect(filter);
      filter.connect(gainNode);
      source.start();
      activeNodes = [source, filter];
    } else if (type === 'brown') {
      const buffer = createNoiseBuffer(ctx, 'brown');
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, ctx.currentTime);

      source.connect(filter);
      filter.connect(gainNode);
      source.start();
      activeNodes = [source, filter];
    } else if (type === 'white') {
      const buffer = createNoiseBuffer(ctx, 'white');
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1000, ctx.currentTime);
      filter.Q.setValueAtTime(0.5, ctx.currentTime);

      source.connect(filter);
      filter.connect(gainNode);
      source.start();
      activeNodes = [source, filter];
    } else if (type === 'binaural') {
      // 40Hz Gamma wave binaural tone: 200Hz in left ear, 240Hz in right ear
      const oscL = ctx.createOscillator();
      const oscR = ctx.createOscillator();
      oscL.frequency.setValueAtTime(200, ctx.currentTime);
      oscR.frequency.setValueAtTime(240, ctx.currentTime);

      const merger = ctx.createChannelMerger(2);
      oscL.connect(merger, 0, 0); // Left channel
      oscR.connect(merger, 0, 1); // Right channel

      merger.connect(gainNode);
      oscL.start();
      oscR.start();

      activeNodes = [oscL, oscR, merger];
    }

    activeSoundscape = type;
  } catch (err) {
    console.warn('Web Audio Soundscape error:', err);
  }
}

export function setSoundscapeVolume(volume: number): void {
  if (gainNode && audioCtx) {
    const targetVolume = Math.max(0.01, Math.min(1, volume));
    fadeTo(gainNode, audioCtx, targetVolume, 0.05);
  }
}

export function stopSoundscape(): void {
  const nodesToStop = [...activeNodes];
  const oldGain = gainNode;
  activeNodes = [];
  gainNode = null;
  activeSoundscape = 'off';

  if (oldGain && audioCtx) {
    try {
      fadeTo(oldGain, audioCtx, 0.0001, 0.04);
      setTimeout(() => {
        try {
          oldGain.disconnect();
          nodesToStop.forEach((node) => {
            if ('stop' in node && typeof (node as { stop?: () => void }).stop === 'function') {
              try { (node as { stop: () => void }).stop(); } catch {}
            }
            try { node.disconnect(); } catch {}
          });
        } catch {}
      }, 150);
    } catch {
      oldGain.disconnect();
      nodesToStop.forEach((n) => { try { n.disconnect(); } catch {} });
    }
  } else {
    nodesToStop.forEach((n) => { try { n.disconnect(); } catch {} });
  }
}

export function getActiveSoundscape(): SoundscapeType {
  return activeSoundscape;
}

/**
 * Synthesizes a soft harmonic dual-tone chime (528Hz / 1056Hz)
 * on the shared AudioContext when deep work focus intervals complete.
 */
export function playCompletionChime(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const chimeGain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(528, now);
    osc1.frequency.exponentialRampToValueAtTime(523.25, now + 1.2);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1056, now);
    osc2.frequency.exponentialRampToValueAtTime(1046.5, now + 1.2);

    chimeGain.gain.setValueAtTime(0.0001, now);
    chimeGain.gain.linearRampToValueAtTime(0.18, now + 0.04);
    chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

    osc1.connect(chimeGain);
    osc2.connect(chimeGain);
    chimeGain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.25);
    osc2.stop(now + 1.25);

    setTimeout(() => {
      try {
        osc1.disconnect();
        osc2.disconnect();
        chimeGain.disconnect();
      } catch {}
    }, 1300);
  } catch (err) {
    console.warn('Completion chime error:', err);
  }
}
