/**
 * 背景フィールドの定義。
 *
 * 画像素材は使わず、すべてCSSのグラデーションと図形だけで描いている。
 * (既存作品の画像・イラストを一切使わないため)
 *
 * 【デザイン: サイバー空間】
 * 8種類とも「暗い空間にグリッドとHUD図形が浮かぶ」という同じ骨格で、
 * 主色(accent)と中央の図形(motif)だけを変えている。
 * こうすることで、どの背景でもカードと文字が読みやすいまま、
 * 場所ごとの雰囲気の違いを出せる。
 *
 * 層の構成:
 *   base   … 空間全体の下地(暗いグラデーション)
 *   grid   … 奥行きを出す格子
 *   motif  … 中央に浮かぶHUD図形
 *   気配   … 漂う粒子や走査ビーム(WeatherEffect が担当)
 */

import type { FieldId } from '../types/ui';

/** 中央に描くHUD図形の種類 */
export type FieldMotif =
  | 'rings' // 同心円(計器)
  | 'circuit' // 回路基板
  | 'hex' // 六角形のセル
  | 'glitch' // 明滅する矩形群
  | 'wave' // 横に走る波形
  | 'orbit' // 傾いた軌道環
  | 'radar' // 走査レーダー
  | 'shards'; // 浮遊する破片

/** 漂うものの種類 */
export type FieldParticle = 'motes' | 'data' | 'ash' | 'spark' | 'none';

export interface FieldDefinition {
  id: FieldId;
  label: string;
  /** HUDに小さく出す英字名 */
  code: string;
  /** 空間の下地 */
  base: string;
  /** この空間の主色。グリッド・図形・粒子はすべてこの色で描く。 */
  accent: string;
  /** 格子1マスの大きさ(px)。小さいほど密に見える。 */
  gridSize: number;
  /** 格子の濃さ(0〜1) */
  gridStrength: number;
  motif: FieldMotif;
  particle: FieldParticle;
}

export const FIELDS: FieldDefinition[] = [
  {
    id: 'plain',
    label: 'データ平原',
    code: 'GRID FIELD',
    base:
      'radial-gradient(120% 90% at 50% 8%,#0B2138 0%,#060D1B 55%,#03060D 100%)',
    accent: '#22D3EE',
    gridSize: 64,
    gridStrength: 0.5,
    motif: 'rings',
    particle: 'motes',
  },
  {
    id: 'coast',
    label: '冷却海',
    code: 'COOLANT SEA',
    base:
      'radial-gradient(130% 100% at 50% 100%,#0A3350 0%,#05172B 55%,#020911 100%)',
    accent: '#31B9FF',
    gridSize: 52,
    gridStrength: 0.45,
    motif: 'wave',
    particle: 'motes',
  },
  {
    id: 'mountain',
    label: '演算山脈',
    code: 'CORE RIDGE',
    base:
      'radial-gradient(120% 90% at 50% 20%,#122038 0%,#080E1D 55%,#03060D 100%)',
    accent: '#7DA6FF',
    gridSize: 76,
    gridStrength: 0.55,
    motif: 'shards',
    particle: 'ash',
  },
  {
    id: 'flower',
    label: '発光回廊',
    code: 'BLOOM CORRIDOR',
    base:
      'radial-gradient(120% 90% at 50% 45%,#2A1140 0%,#120722 55%,#06030D 100%)',
    accent: '#C46BFF',
    gridSize: 44,
    gridStrength: 0.4,
    motif: 'hex',
    particle: 'spark',
  },
  {
    id: 'snow',
    label: '静寂圏',
    code: 'WHITE NOISE',
    base:
      'radial-gradient(120% 90% at 50% 30%,#16222E 0%,#0A1119 55%,#04070C 100%)',
    accent: '#B8E6F5',
    gridSize: 58,
    gridStrength: 0.35,
    motif: 'glitch',
    particle: 'data',
  },
  {
    id: 'autumn',
    label: '熱暴走域',
    code: 'OVERHEAT ZONE',
    base:
      'radial-gradient(130% 100% at 50% 100%,#3A1608 0%,#1A0A08 55%,#0A0405 100%)',
    accent: '#FF7A33',
    gridSize: 48,
    gridStrength: 0.5,
    motif: 'radar',
    particle: 'spark',
  },
  {
    id: 'ruins',
    label: '廃棄サーバ',
    code: 'DEAD SERVER',
    base:
      'radial-gradient(120% 90% at 50% 12%,#122A22 0%,#08150F 55%,#030806 100%)',
    accent: '#3FE09A',
    gridSize: 40,
    gridStrength: 0.6,
    motif: 'circuit',
    particle: 'data',
  },
  {
    id: 'skyIsland',
    label: '軌道基地',
    code: 'ORBITAL',
    base:
      'radial-gradient(120% 100% at 50% 65%,#0D1B3C 0%,#070D1F 55%,#03050C 100%)',
    accent: '#8FA2FF',
    gridSize: 88,
    gridStrength: 0.4,
    motif: 'orbit',
    particle: 'motes',
  },
];

export function getField(id: FieldId): FieldDefinition {
  return FIELDS.find((f) => f.id === id) ?? FIELDS[0];
}

/** ランダムに1つ選ぶ(試合開始時に使う) */
export function randomFieldId(): FieldId {
  return FIELDS[Math.floor(Math.random() * FIELDS.length)].id;
}
