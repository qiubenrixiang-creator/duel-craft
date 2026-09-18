/**
 * 効果音とBGM。
 *
 * 音声ファイルを一切使わず、Web Audio API で波形を合成して鳴らしている。
 * このため:
 *   - 既存作品の音源を使わずに済む
 *   - ファイルの読み込みが発生せず、動作が軽い
 *
 * ミュート状態はモジュール内の変数で保持し、どこからでも playSE() を
 * 呼べるようにしている(状態を引数で引き回さなくてよい)。
 */

let audioCtx: AudioContext | null = null;

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  return audioCtx;
}

interface BeepOptions {
  freq?: number;
  duration?: number;
  type?: OscillatorType;
  volume?: number;
  /** 指定すると、その周波数へ滑らかに変化する */
  sweepTo?: number | null;
  delay?: number;
}

/** 単音を鳴らす。すべての音はこれを組み合わせて作る。 */
function beep({
  freq = 440,
  duration = 0.15,
  type = 'sine',
  volume = 0.2,
  sweepTo = null,
  delay = 0,
}: BeepOptions): void {
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    // ブラウザの制限で停止している場合は再開する
    if (ctx.state === 'suspended') void ctx.resume();

    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, t0 + duration);

    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch {
    /* 音が鳴らせなくてもゲームは続行できるため、握りつぶす */
  }
}

/** 効果音の種類 */
export type SoundName =
  | 'chargeMana'
  | 'cardPlay'
  | 'attack'
  | 'block'
  | 'shieldBreak'
  | 'sTrigger'
  | 'turnEnd'
  | 'win'
  | 'lose'
  | 'uiClick'
  | 'error';

const PRESETS: Record<SoundName, () => void> = {
  chargeMana: () => beep({ freq: 320, duration: 0.1, volume: 0.15 }),
  cardPlay: () => beep({ freq: 520, duration: 0.12, type: 'triangle', volume: 0.18 }),
  attack: () =>
    beep({ freq: 200, duration: 0.16, type: 'sawtooth', volume: 0.2, sweepTo: 90 }),
  block: () => beep({ freq: 150, duration: 0.15, type: 'square', volume: 0.2 }),
  shieldBreak: () => {
    beep({ freq: 900, duration: 0.06, type: 'square', volume: 0.15 });
    beep({
      freq: 220,
      duration: 0.25,
      type: 'sawtooth',
      volume: 0.2,
      sweepTo: 60,
      delay: 0.05,
    });
  },
  sTrigger: () => {
    [660, 880, 1100].forEach((f, i) =>
      beep({ freq: f, duration: 0.12, volume: 0.18, delay: i * 0.09 })
    );
  },
  turnEnd: () => {
    beep({ freq: 440, duration: 0.1, volume: 0.14 });
    beep({ freq: 660, duration: 0.15, volume: 0.14, delay: 0.1 });
  },
  win: () => {
    [523, 659, 784, 1046].forEach((f, i) =>
      beep({ freq: f, duration: 0.18, type: 'triangle', volume: 0.2, delay: i * 0.12 })
    );
  },
  lose: () => {
    [440, 349, 262].forEach((f, i) =>
      beep({ freq: f, duration: 0.22, type: 'triangle', volume: 0.18, delay: i * 0.14 })
    );
  },
  uiClick: () => beep({ freq: 700, duration: 0.05, volume: 0.1 }),
  error: () => beep({ freq: 180, duration: 0.12, type: 'square', volume: 0.14 }),
};

let seMuted = false;

export function setSoundMuted(muted: boolean): void {
  seMuted = muted;
}

export function isSoundMuted(): boolean {
  return seMuted;
}

/** 効果音を鳴らす */
export function playSE(name: SoundName): void {
  if (seMuted) return;
  PRESETS[name]?.();
}

/* ===== BGM ===== */

/**
 * BGMも合成で作る。
 * メニュー用は落ち着いた音、対戦中は少し緊張感のある音にしている。
 */
interface BgmPattern {
  /** 0 は休符 */
  notes: number[];
  /** 1音あたりの長さ(秒) */
  step: number;
  type: OscillatorType;
  volume: number;
}

const BGM_PATTERNS: Record<BgmMood, BgmPattern> = {
  menu: {
    notes: [
      261.63, 0, 329.63, 0, 392.0, 349.23, 329.63, 0, 293.66, 0, 329.63, 0, 392.0,
      440.0, 392.0, 0,
    ],
    step: 0.42,
    type: 'sine',
    volume: 0.05,
  },
  battle: {
    notes: [
      220, 220, 261.63, 220, 196, 196, 246.94, 220, 220, 220, 261.63, 293.66,
      261.63, 220, 196, 220,
    ],
    step: 0.26,
    type: 'triangle',
    volume: 0.06,
  },
};

export type BgmMood = 'menu' | 'battle';

let bgmTimer: ReturnType<typeof setInterval> | null = null;
let bgmMuted = false;
let bgmMood: BgmMood | null = null;

export function setBgmMuted(muted: boolean): void {
  bgmMuted = muted;
}

export function isBgmMuted(): boolean {
  return bgmMuted;
}

export function stopBgm(): void {
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
  bgmMood = null;
}

/** BGMを開始する。同じ曲調が既に鳴っていれば何もしない。 */
export function startBgm(mood: BgmMood): void {
  if (bgmMood === mood && bgmTimer) return;
  stopBgm();
  bgmMood = mood;

  const pattern = BGM_PATTERNS[mood];
  let index = 0;

  const playStep = () => {
    if (bgmMuted) return;
    const freq = pattern.notes[index % pattern.notes.length];
    if (freq > 0) {
      beep({
        freq,
        duration: pattern.step * 0.9,
        type: pattern.type,
        volume: pattern.volume,
      });
    }
    index++;
  };

  playStep();
  bgmTimer = setInterval(playStep, pattern.step * 1000);
}

/**
 * ブラウザは、利用者が一度操作するまで音を鳴らせない。
 * 最初のタップ/クリックで音声を有効化するために呼ぶ。
 */
export function unlockAudio(): void {
  const ctx = getAudioCtx();
  if (ctx?.state === 'suspended') void ctx.resume();
}
