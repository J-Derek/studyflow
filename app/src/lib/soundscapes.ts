import type { SoundscapeType } from '../types';

/**
 * Calm background sounds, generated in the browser with Web Audio (nothing is downloaded).
 * Everything is kept soft on purpose: no steady pure tones, no harsh hiss, slow fades in and out.
 */

let audioCtx: AudioContext | null = null;
let activeNodes: AudioNode[] = [];
let activeTimers: number[] = [];
let gainNode: GainNode | null = null;
let activeSoundscape: SoundscapeType = 'off';
const noiseBufferCache = new Map<'pink' | 'brown' | 'white', AudioBuffer>();
let impulse: AudioBuffer | null = null;

/** Loudness trim per sound so switching between them does not jump in volume. */
const TRIM: Record<Exclude<SoundscapeType, 'off'>, number> = {
  rain: 0.9,
  waves: 0.85,
  pad: 0.8,
  keys: 0.9,
  brown: 0.8,
  breeze: 0.7,
  chimes: 0.8
};

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

/** Looped noise buffer, generated once per colour. */
function createNoiseBuffer(ctx: AudioContext, type: 'pink' | 'brown' | 'white'): AudioBuffer {
  const cached = noiseBufferCache.get(type);
  if (cached) return cached;

  const bufferSize = ctx.sampleRate * 6;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  } else if (type === 'pink') {
    // Paul Kellet's refined filter method
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  // Short crossfade at the loop point so the seam is not audible.
  const fade = Math.floor(ctx.sampleRate * 0.25);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    data[i] = data[i] * t + data[bufferSize - fade + i] * (1 - t);
  }
  noiseBufferCache.set(type, buffer);
  return buffer;
}

/** A soft, dark room reverb built from decaying noise. */
function getImpulse(ctx: AudioContext): AudioBuffer {
  if (impulse) return impulse;
  const seconds = 3.4;
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  impulse = buf;
  return buf;
}

function reverbSend(ctx: AudioContext, dest: AudioNode, wet: number): GainNode {
  const send = ctx.createGain();
  send.gain.value = wet;
  const conv = ctx.createConvolver();
  conv.buffer = getImpulse(ctx);
  const damp = ctx.createBiquadFilter();
  damp.type = 'lowpass';
  damp.frequency.value = 2400;
  send.connect(conv);
  conv.connect(damp);
  damp.connect(dest);
  activeNodes.push(send, conv, damp);
  return send;
}

function fadeTo(g: GainNode, c: AudioContext, target: number, tc = 0.08): void {
  const t = c.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
  g.gain.setTargetAtTime(target, t, tc);
}

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]!;

function every(fn: () => void, minMs: number, maxMs: number): void {
  const loop = () => {
    fn();
    activeTimers.push(window.setTimeout(loop, rand(minMs, maxMs)));
  };
  activeTimers.push(window.setTimeout(loop, rand(minMs, maxMs) * 0.3));
}

/** A slow oscillator that gently moves an audio parameter. */
function lfo(ctx: AudioContext, hz: number, depth: number, target: AudioParam): void {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.value = hz;
  g.gain.value = depth;
  osc.connect(g);
  g.connect(target);
  osc.start();
  activeNodes.push(osc, g);
}

function noiseSource(ctx: AudioContext, colour: 'pink' | 'brown' | 'white'): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = createNoiseBuffer(ctx, colour);
  source.loop = true;
  source.loopStart = 0;
  source.start(0, Math.random() * 3);
  activeNodes.push(source);
  return source;
}

function startRain(ctx: AudioContext, out: AudioNode): void {
  const base = noiseSource(ctx, 'pink');
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 220;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2600;
  const body = ctx.createGain();
  body.gain.value = 0.55;
  base.connect(hp);
  hp.connect(lp);
  lp.connect(body);
  body.connect(out);
  lfo(ctx, 0.07, 0.1, body.gain);
  activeNodes.push(hp, lp, body);

  // Individual drops: tiny, soft, at random places in the stereo field.
  const dropNoise = createNoiseBuffer(ctx, 'white');
  every(
    () => {
      const src = ctx.createBufferSource();
      src.buffer = dropNoise;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = rand(1800, 4200);
      bp.Q.value = 1.2;
      const g = ctx.createGain();
      const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(rand(0.03, 0.09), t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.03, 0.07));
      const pan = ctx.createStereoPanner();
      pan.pan.value = rand(-0.8, 0.8);
      src.connect(bp);
      bp.connect(g);
      g.connect(pan);
      pan.connect(out);
      src.start(t, Math.random() * 4, 0.1);
      src.stop(t + 0.12);
    },
    70,
    240
  );
}

function startWaves(ctx: AudioContext, out: AudioNode): void {
  const src = noiseSource(ctx, 'pink');
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 500;
  lp.Q.value = 0.6;
  const swell = ctx.createGain();
  swell.gain.value = 0.55;
  src.connect(lp);
  lp.connect(swell);
  swell.connect(out);
  lfo(ctx, 0.085, 0.38, swell.gain); // the swell rises and falls about every 12 seconds
  lfo(ctx, 0.085, 260, lp.frequency); // brighter as the wave arrives
  activeNodes.push(lp, swell);
}

function startBrown(ctx: AudioContext, out: AudioNode): void {
  const src = noiseSource(ctx, 'brown');
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  const g = ctx.createGain();
  g.gain.value = 0.7;
  src.connect(lp);
  lp.connect(g);
  g.connect(out);
  activeNodes.push(lp, g);
}

function startBreeze(ctx: AudioContext, out: AudioNode): void {
  const src = noiseSource(ctx, 'pink');
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 480;
  bp.Q.value = 0.6;
  // keep the top end soft so it never sounds like hiss
  const soft = ctx.createBiquadFilter();
  soft.type = 'lowpass';
  soft.frequency.value = 1100;
  const g = ctx.createGain();
  g.gain.value = 0.7;
  src.connect(bp);
  bp.connect(soft);
  soft.connect(g);
  g.connect(out);
  lfo(ctx, 0.05, 240, bp.frequency);
  lfo(ctx, 0.037, 0.2, g.gain);
  activeNodes.push(bp, soft, g);
}

/** Slow, warm chords that change every ~12 seconds. */
function startPad(ctx: AudioContext, out: AudioNode): void {
  const wet = reverbSend(ctx, out, 0.5);
  const chords = [
    [48, 52, 55, 59, 64], // C major 7
    [45, 52, 55, 60, 64], // A minor 7
    [41, 48, 52, 57, 60], // F major 7
    [43, 50, 55, 59, 64] //  G add 6
  ];
  let i = 0;
  const play = () => {
    const chord = chords[i % chords.length]!;
    i += 1;
    const t = ctx.currentTime;
    const hold = 17;
    for (const n of chord) {
      for (const [type, detune] of [['sine', -4], ['triangle', 5]] as const) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = midi(n);
        osc.detune.value = detune;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(type === 'sine' ? 0.045 : 0.018, t + 4.5);
        g.gain.setValueAtTime(type === 'sine' ? 0.045 : 0.018, t + hold - 6);
        g.gain.linearRampToValueAtTime(0.0001, t + hold);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 850;
        osc.connect(g);
        g.connect(lp);
        lp.connect(out);
        lp.connect(wet);
        osc.start(t);
        osc.stop(t + hold + 0.1);
        activeNodes.push(osc, g, lp);
      }
    }
  };
  play();
  activeTimers.push(window.setInterval(play, 12000));
}

/** Soft piano-like notes from a pentatonic scale, spaced out so it never becomes a tune you must follow. */
function startKeys(ctx: AudioContext, out: AudioNode): void {
  const wet = reverbSend(ctx, out, 0.55);
  const scale = [60, 62, 64, 67, 69, 72, 74];
  every(
    () => {
      const notes = Math.random() < 0.25 ? [pick(scale), pick(scale) - 12] : [pick(scale)];
      for (const n of notes) bell(ctx, out, wet, midi(n), 0.085, 4.2, 3000);
    },
    2600,
    6200
  );
}

/** Very soft, high, sparse bell tones for breaks. */
function startChimes(ctx: AudioContext, out: AudioNode): void {
  const wet = reverbSend(ctx, out, 0.7);
  const scale = [72, 74, 76, 79, 81, 84];
  every(() => bell(ctx, out, wet, midi(pick(scale)), 0.06, 6.5, 4200), 4500, 9500);
}

/** One struck note: a quick attack, a long natural decay, and a faint overtone. */
function bell(ctx: AudioContext, dry: AudioNode, wet: AudioNode, freq: number, peak: number, decay: number, cutoff: number): void {
  const t = ctx.currentTime;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = cutoff;
  lp.connect(dry);
  lp.connect(wet);
  for (const [mult, level, len] of [[1, 1, decay], [2, 0.22, decay * 0.45]] as const) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak * level, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    osc.connect(g);
    g.connect(lp);
    osc.start(t);
    osc.stop(t + len + 0.1);
    osc.onended = () => {
      try {
        osc.disconnect();
        g.disconnect();
      } catch {
        /* already gone */
      }
    };
  }
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
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    gainNode = master;
    master.connect(ctx.destination);
    // The sound itself rises slowly, so starting the timer never startles.
    const level = ctx.createGain();
    level.gain.value = TRIM[type];
    level.connect(master);
    activeNodes.push(level);
    fadeTo(master, ctx, targetVolume, 0.9);

    switch (type) {
      case 'rain':
        startRain(ctx, level);
        break;
      case 'waves':
        startWaves(ctx, level);
        break;
      case 'brown':
        startBrown(ctx, level);
        break;
      case 'breeze':
        startBreeze(ctx, level);
        break;
      case 'pad':
        startPad(ctx, level);
        break;
      case 'keys':
        startKeys(ctx, level);
        break;
      case 'chimes':
        startChimes(ctx, level);
        break;
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
  const timers = [...activeTimers];
  const oldGain = gainNode;
  activeNodes = [];
  activeTimers = [];
  gainNode = null;
  activeSoundscape = 'off';
  timers.forEach((t) => {
    window.clearTimeout(t);
    window.clearInterval(t);
  });

  const cleanup = () => {
    nodesToStop.forEach((node) => {
      if ('stop' in node && typeof (node as { stop?: () => void }).stop === 'function') {
        try {
          (node as unknown as { stop: () => void }).stop();
        } catch {
          /* already stopped */
        }
      }
      try {
        node.disconnect();
      } catch {
        /* already disconnected */
      }
    });
  };

  if (oldGain && audioCtx) {
    try {
      fadeTo(oldGain, audioCtx, 0.0001, 0.12);
      setTimeout(() => {
        try {
          oldGain.disconnect();
        } catch {
          /* already disconnected */
        }
        cleanup();
      }, 700);
    } catch {
      cleanup();
    }
  } else {
    cleanup();
  }
}

export function getActiveSoundscape(): SoundscapeType {
  return activeSoundscape;
}

/** A soft two-note chime when a focus block ends. */
export function playCompletionChime(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(ctx.destination);
    const wet = ctx.createConvolver();
    wet.buffer = getImpulse(ctx);
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.35;
    wet.connect(wetGain);
    wetGain.connect(out);
    for (const [i, n] of [72, 79].entries()) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = midi(n);
      const g = ctx.createGain();
      const t = now + i * 0.28;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.11, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
      osc.connect(g);
      g.connect(out);
      g.connect(wet);
      osc.start(t);
      osc.stop(t + 2.3);
    }
    setTimeout(() => {
      try {
        out.disconnect();
        wet.disconnect();
        wetGain.disconnect();
      } catch {
        /* already gone */
      }
    }, 3200);
  } catch (err) {
    console.warn('Completion chime error:', err);
  }
}
