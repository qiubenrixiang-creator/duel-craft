/**
 * 効果音とBGM。
 *
 * 効果音は Web Audio API で波形を合成して鳴らしている(ファイル不要で軽い)。
 * BGM は public/bgm/ に置いた音声ファイルを鳴らす。
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
 * BGMは音声ファイル(public/bgm/*.mp3)を鳴らす。
 *
 * 曲を差し替えたいときは、public/bgm/ の中の同名ファイルを
 * 置き換えるだけでよい(コードの変更は不要)。
 *
 *   menu.mp3   … ホーム画面
 *   battle.mp3 … 対戦中
 *   result.mp3 … 決着(勝敗が決まったあと)
 *
 * 【ブラウザの制限について】
 * スマートフォンでは「利用者が一度画面に触れるまで音を鳴らせない」決まりが
 * あるため、最初のタップまでは再生を保留し、unlockAudio() が呼ばれた時点で
 * 鳴らし始める。
 */

export type BgmMood = 'menu' | 'battle' | 'result';

/**
 * import.meta.env.BASE_URL には公開先のパス(/duel-craft/)が入る。
 * これを付けないとGitHub Pagesで音声が見つからない。
 */
const BGM_SRC: Record<BgmMood, string> = {
  menu: `${import.meta.env.BASE_URL}bgm/menu.mp3`,
  battle: `${import.meta.env.BASE_URL}bgm/battle.mp3`,
  result: `${import.meta.env.BASE_URL}bgm/result.mp3`,
};

/** 曲ごとの音量(0〜1)。効果音を邪魔しない程度に抑える。 */
const BGM_GAIN: Record<BgmMood, number> = {
  menu: 0.45,
  battle: 0.4,
  result: 0.5,
};

/** 曲を切り替えるときのフェード時間(ミリ秒) */
const FADE_MS = 700;

const players = new Map<BgmMood, HTMLAudioElement>();
const fadeTimers = new Map<BgmMood, ReturnType<typeof setInterval>>();

let bgmMuted = false;
let currentMood: BgmMood | null = null;
/** まだ音を鳴らせない間、鳴らしたい曲を覚えておく */
let pendingMood: BgmMood | null = null;
let audioUnlocked = false;

function getPlayer(mood: BgmMood): HTMLAudioElement | null {
  if (typeof Audio === 'undefined') return null;
  let el = players.get(mood);
  if (!el) {
    el = new Audio(BGM_SRC[mood]);
    el.loop = true;
    el.preload = 'none';
    el.volume = 0;
    // 音量を下げても消えないように、再生位置は保持する
    players.set(mood, el);
  }
  return el;
}

/** 音量を目標値までなめらかに変える。0にしたときは停止する。 */
function fadeTo(mood: BgmMood, target: number, onDone?: () => void): void {
  const el = players.get(mood);
  if (!el) return;

  const existing = fadeTimers.get(mood);
  if (existing) clearInterval(existing);

  const stepMs = 50;
  const steps = Math.max(1, Math.round(FADE_MS / stepMs));
  const delta = (target - el.volume) / steps;
  let count = 0;

  const timer = setInterval(() => {
    count++;
    const next = el.volume + delta;
    el.volume = Math.min(1, Math.max(0, next));
    if (count >= steps) {
      el.volume = Math.min(1, Math.max(0, target));
      clearInterval(timer);
      fadeTimers.delete(mood);
      onDone?.();
    }
  }, stepMs);

  fadeTimers.set(mood, timer);
}

/** 実際に切り替える(音が鳴らせる状態になってから呼ぶ) */
function switchTo(mood: BgmMood): void {
  const previous = currentMood;
  currentMood = mood;
  pendingMood = null;

  if (previous && previous !== mood) {
    fadeTo(previous, 0, () => {
      const old = players.get(previous);
      if (old && currentMood !== previous) {
        old.pause();
        old.currentTime = 0;
      }
    });
  }

  const el = getPlayer(mood);
  if (!el) return;

  el.preload = 'auto';
  if (bgmMuted) {
    el.volume = 0;
    return;
  }

  // 再生開始は失敗することがある(未操作など)ので、必ず握りつぶす
  const started = el.play();
  if (started && typeof started.catch === 'function') {
    started.catch(() => {
      // 鳴らせなかった場合は、次のタップでもう一度試す
      pendingMood = mood;
      audioUnlocked = false;
    });
  }
  fadeTo(mood, BGM_GAIN[mood]);
}

/**
 * BGMを開始する。同じ曲が既に鳴っていれば何もしない。
 * まだ画面に触れられていない場合は、最初のタップまで待つ。
 */
export function startBgm(mood: BgmMood): void {
  if (currentMood === mood && !pendingMood) return;
  if (!audioUnlocked) {
    pendingMood = mood;
    return;
  }
  switchTo(mood);
}

export function stopBgm(): void {
  pendingMood = null;
  if (currentMood) {
    const mood = currentMood;
    currentMood = null;
    fadeTo(mood, 0, () => {
      const el = players.get(mood);
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
    });
  }
}

export function setBgmMuted(muted: boolean): void {
  bgmMuted = muted;
  if (!currentMood) return;

  if (muted) {
    fadeTo(currentMood, 0);
  } else {
    const el = getPlayer(currentMood);
    if (el) void el.play()?.catch(() => undefined);
    fadeTo(currentMood, BGM_GAIN[currentMood]);
  }
}

export function isBgmMuted(): boolean {
  return bgmMuted;
}

/**
 * ブラウザは、利用者が一度操作するまで音を鳴らせない。
 * 最初のタップ/クリックで音声を有効化するために呼ぶ。
 */
export function unlockAudio(): void {
  const ctx = getAudioCtx();
  if (ctx?.state === 'suspended') void ctx.resume();

  audioUnlocked = true;

  const want = pendingMood ?? currentMood;
  if (want) {
    // 保留していた曲、または止まってしまった曲を鳴らし直す
    const el = players.get(want);
    if (!el || el.paused || want !== currentMood) {
      currentMood = null;
      switchTo(want);
    }
  }
}
