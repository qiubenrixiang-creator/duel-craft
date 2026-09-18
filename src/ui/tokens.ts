/**
 * 見た目に関する値の定義。
 *
 * 色やサイズをここにまとめ、各コンポーネントは必ずここを参照する。
 * (仕様書の「ハードコード禁止」に対応)
 */

import type { Civilization } from '../types/card';

/** ガラスUIの基本。背景が透けて見える程度の透明度にする。 */
export const GLASS = {
  panel: 'rgba(15,23,42,0.72)',
  panelSoft: 'rgba(15,23,42,0.55)',
  edge: 'rgba(255,255,255,0.22)',
  edgeSoft: 'rgba(255,255,255,0.12)',
  blur: 'blur(10px)',
} as const;

export const INK = {
  base: '#F4F7FB',
  dim: 'rgba(244,247,251,0.62)',
  /** カード面は明るい背景なので、文字は濃い色にする */
  onCard: '#16233B',
  onCardDim: '#5A6B85',
} as const;

/** 文明ごとのアクセント色。UIの強調にのみ使い、背景は変えない。 */
export const CIV_COLOR: Record<Civilization, string> = {
  fire: '#FF8A3D',
  water: '#4FB8F5',
  nature: '#3FD08A',
  light: '#FFD24A',
  darkness: '#B47BF5',
};

/** カード面のイラスト領域に使う淡いグラデーション(画像未設定時) */
export const CIV_ART_GRADIENT: Record<Civilization, string> = {
  fire: 'linear-gradient(150deg,#FFD9B0,#FF9A56)',
  water: 'linear-gradient(150deg,#CDEBFF,#63B9F0)',
  nature: 'linear-gradient(150deg,#D5F5DF,#5CC894)',
  light: 'linear-gradient(150deg,#FFF3C8,#FFD24A)',
  darkness: 'linear-gradient(150deg,#E4D4FA,#A87BE8)',
};

/** パワー表示など、カード上で濃く出したい文明色 */
export const CIV_DEEP: Record<Civilization, string> = {
  fire: '#D2551A',
  water: '#1D7FC0',
  nature: '#218F5E',
  light: '#B8890A',
  darkness: '#7B45C4',
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
  select: '#4FB8F5',
  /** ターン終了ボタン */
  gold: '#FFD24A',
  /** 攻撃ボタン */
  navy: '#2B4A8B',
  /** 危険な操作(ダイレクトアタックなど) */
  danger: '#E4572E',
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

/** 長押しと判定するまでの時間 */
export const LONG_PRESS_MS = 500;

/**
 * 画面幅から拡大率を求める。
 *
 * 1920pxを基準とし、それより狭い画面では縮小する。
 * iPhone横(844px程度)では約0.44倍になり、仕様書の想定と一致する。
 */
export function computeScale(viewportWidth: number, viewportHeight: number): number {
  const byWidth = viewportWidth / 1920;
  // 高さが足りない端末でも収まるようにする
  const byHeight = viewportHeight / 1080;
  return Math.min(byWidth, byHeight, 1);
}
