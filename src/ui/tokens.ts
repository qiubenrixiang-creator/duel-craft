/**
 * 見た目に関する値の定義。
 *
 * 色やサイズをここにまとめ、各コンポーネントは必ずここを参照する。
 * (仕様書の「ハードコード禁止」に対応)
 *
 * 【デザインの方針: サイバーHUD】
 * 真っ黒に近い紺をベースに、シアンの細い発光線で情報を囲む。
 * 面は塗らずに「線と角のブラケットで示す」ことで、
 * カードのイラストと文明色が背景に埋もれないようにしている。
 */

import type { Civilization } from '../types/card';

/** 画面全体の下地。ここより明るい色は情報を持つ要素だけに使う。 */
export const VOID = {
  base: '#04070F',
  deep: '#070D1A',
  raised: '#0B1426',
} as const;

/** UI全体の基準となるネオン色(シアン) */
export const NEON = {
  core: '#22D3EE',
  bright: '#7DF9FF',
  dim: 'rgba(34,211,238,0.55)',
  faint: 'rgba(34,211,238,0.22)',
  ghost: 'rgba(34,211,238,0.10)',
  glow: 'rgba(34,211,238,0.45)',
} as const;

/**
 * パネル(情報を載せる面)。
 * 半透明の紺 + シアンの縁 + 発光で、HUDらしい浮遊感を出す。
 */
export const GLASS = {
  panel: 'rgba(7,16,31,0.78)',
  panelSoft: 'rgba(7,16,31,0.52)',
  edge: 'rgba(34,211,238,0.55)',
  edgeSoft: 'rgba(34,211,238,0.20)',
  blur: 'blur(8px)',
} as const;

export const INK = {
  base: '#DCF4FF',
  dim: 'rgba(156,203,226,0.62)',
  /** カード面もダークなので、カード上の文字も明るい色にする */
  onCard: '#E4F5FF',
  onCardDim: 'rgba(150,196,222,0.60)',
} as const;

/** 文明ごとのアクセント色。暗い背景で映えるよう彩度を上げている。 */
export const CIV_COLOR: Record<Civilization, string> = {
  fire: '#FF6A33',
  water: '#31B9FF',
  nature: '#2FE39B',
  light: '#FFD84A',
  darkness: '#B863FF',
};

/**
 * カード面のイラスト領域に使う背景(画像未設定時)。
 * ダークカードに合わせ、文明色をうっすら発光させた暗いグラデーションにする。
 */
export const CIV_ART_GRADIENT: Record<Civilization, string> = {
  fire: 'radial-gradient(120% 90% at 30% 20%,rgba(255,106,51,0.55),rgba(90,22,6,0.9) 60%,#180703)',
  water: 'radial-gradient(120% 90% at 30% 20%,rgba(49,185,255,0.55),rgba(6,48,90,0.9) 60%,#03101E)',
  nature: 'radial-gradient(120% 90% at 30% 20%,rgba(47,227,155,0.5),rgba(7,68,48,0.9) 60%,#03150F)',
  light: 'radial-gradient(120% 90% at 30% 20%,rgba(255,216,74,0.5),rgba(92,70,6,0.9) 60%,#181203)',
  darkness:
    'radial-gradient(120% 90% at 30% 20%,rgba(184,99,255,0.5),rgba(56,16,94,0.9) 60%,#0F0419)',
};

/** パワー表示など、暗いカード上で強く光らせたい文明色 */
export const CIV_DEEP: Record<Civilization, string> = {
  fire: '#FF9160',
  water: '#6FD2FF',
  nature: '#6BF3BE',
  light: '#FFE886',
  darkness: '#D09BFF',
};

export const CIV_LABEL: Record<Civilization, string> = {
  fire: '火',
  water: '水',
  nature: '自然',
  light: '光',
  darkness: '闇',
};

export const ALL_CIVILIZATIONS: Civilization[] = [
  'fire',
  'water',
  'light',
  'darkness',
  'nature',
];

/** 操作の強調色 */
export const ACCENT = {
  /** 選択中のカードの発光 */
  select: '#22D3EE',
  /** 主要な操作(ターン終了など)。シアンと区別するため琥珀色にする。 */
  gold: '#FFC53D',
  /** 攻撃ボタン */
  navy: '#0B3A55',
  /** 危険な操作(ダイレクトアタックなど) */
  danger: '#FF4D6D',
} as const;

/**
 * カードの基準サイズ(1920px幅を想定)。
 * 実際の描画では画面幅に応じた倍率をかける。
 */
export const CARD_SIZE = {
  width: 120,
  height: 168, // 5:7
  manaWidth: 72,
  manaHeight: 102,
} as const;

/** アニメーションの時間(仕様書の指定値) */
export const DURATION = {
  draw: 300,
  summon: 250,
  toMana: 220,
  tap: 180,
  shieldBreak: 450,
  select: 120,
} as const;

export const EASING = 'cubic-bezier(0.22,1,0.36,1)';

/* ===== HUDの形 ===== */

/**
 * 角を斜めに切り落とした八角形。サイバーHUDらしい輪郭を作る。
 * cut は切り落とす大きさ(px)。
 */
export function clipCorners(cut: number): string {
  const c = `${cut}px`;
  return (
    `polygon(${c} 0, calc(100% - ${c}) 0, 100% ${c}, ` +
    `100% calc(100% - ${c}), calc(100% - ${c}) 100%, ${c} 100%, 0 calc(100% - ${c}), 0 ${c})`
  );
}

/**
 * 左上と右下だけを切り落とした形。
 * カードやボタンに向きを与えたいときに使う。
 */
export function clipDiagonal(cut: number): string {
  const c = `${cut}px`;
  return `polygon(${c} 0, 100% 0, 100% calc(100% - ${c}), calc(100% - ${c}) 100%, 0 100%, 0 ${c})`;
}

/** 発光する細い枠線(HUDパネルの基本) */
export function neonEdge(color: string, width = 1, glow = 10): string {
  return `inset 0 0 0 ${width}px ${color}, 0 0 ${glow}px rgba(34,211,238,0.18)`;
}

/** 長押しと判定するまでの時間 */
export const LONG_PRESS_MS = 500;

/**
 * 画面サイズから拡大率を求める。
 *
 * 以前は「1920x1080の画面をそのまま縮める」計算だったが、
 * スマートフォンの横画面は 852x393 のように"横に細長い"形をしているため、
 * 高さで割ると 0.36倍 まで縮んでしまい、左右に大きな余白が出て
 * 「画面が遠い」状態になっていた。
 *
 * そこで、1920x1080という見た目の比率ではなく、
 * 「レイアウトが必要とする実際の寸法」を基準にする。
 *
 *   高さ … 相手の場・ターンバー・自分の場・手札 が縦に並ぶのに必要な分
 *   幅   … シールド/マナ/山札の固定列 + バトルゾーン5枚分
 *
 * これで iPhone横持ちでは約0.52倍となり、従来より約1.5倍大きく表示される。
 */

/**
 * 縦に必要な基準の高さ(この値で画面の高さを割る)。
 *
 * 内訳: 相手の場(183) + ターンバー(92) + 自分の場(183) + 手札(183) + 余白
 * 文字サイズには下限があり計算より数px大きくなるため、少し余裕を持たせている。
 */
const LAYOUT_HEIGHT = 725;
/** 横に必要な基準の幅 */
const LAYOUT_WIDTH = 1622;

/** これ以上小さいと文字が読めないという下限 */
const MIN_SCALE = 0.34;

export function computeScale(viewportWidth: number, viewportHeight: number): number {
  const byWidth = viewportWidth / LAYOUT_WIDTH;
  const byHeight = viewportHeight / LAYOUT_HEIGHT;
  // 大きい画面では等倍を超えないようにする
  const fit = Math.min(byWidth, byHeight, 1);
  return Math.max(MIN_SCALE, fit);
}
