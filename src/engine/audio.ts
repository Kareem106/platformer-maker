// Tiny WebAudio synth — no assets needed. Safe to call before user gesture (lazy ctx).
let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

function ac(): AudioContext | null {
  if (muted) return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function beep(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.12, slide = 0) {
  const c = ac();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur);
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g).connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

export const sfx = {
  jump() { beep(300, 0.15, 'square', 0.1, 250); },
  doubleJump() { beep(420, 0.15, 'square', 0.1, 300); },
  coin() { beep(880, 0.09, 'square', 0.08); setTimeout(() => beep(1320, 0.12, 'square', 0.08), 70); },
  hurt() { beep(200, 0.25, 'sawtooth', 0.14, -120); },
  shoot() { beep(700, 0.08, 'sawtooth', 0.06, -300); },
  stomp() { beep(180, 0.12, 'square', 0.12, -80); },
  win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => beep(f, 0.18, 'square', 0.1), i * 110)); },
  lose() { [400, 300, 200, 140].forEach((f, i) => setTimeout(() => beep(f, 0.2, 'sawtooth', 0.1), i * 130)); },
};
