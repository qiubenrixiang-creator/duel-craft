/**
 * UIの状態に関する型定義。
 *
 * ここで定義する UIState は、その端末を操作している人だけに関係する情報。
 * 通信で相手に送らないため、相手の操作が自分の画面に干渉することがない。
 */

import type { Seat, ZoneId, AttackTargetType } from './game';

/**
 * 確認待ちの操作。
 * 「カードを選ぶ → 実行先を決める → 確認して実行」の2段階目にあたる。
 * ここに値が入っている間は確認バーが表示され、決定かキャンセルを待つ。
 */
export type PendingAction =
  | {
      type: 'summon';
      instId: string;
      /** ツインパクトの場合、どちらの面を使うか */
      side?: 'creature' | 'spell';
      /** 進化クリーチャーの場合、どのクリーチャーの上に置くか */
      evolveTargetInstId?: string;
    }
  | { type: 'charge'; instId: string }
  | { type: 'equip'; gearInstId: string; creatureInstId: string }
  | {
      type: 'attack';
      attackerInstId: string;
      targetType: AttackTargetType;
      targetCreatureInstId?: string;
      /** 革命チェンジ・侵略で入れ替える手札のカード */
      transformHandInstId?: string;
      transformMode?: 'revolutionChange' | 'invasion';
    }
  | { type: 'endTurn' }
  | { type: 'toMainPhase' }
  | { type: 'toAttackPhase' };

/** ドロップ先の識別子 */
export type DropZoneId =
  | 'ownBattle' // 自分のバトルゾーン(召喚)
  | 'ownMana' // 自分のマナゾーン(マナチャージ)
  | 'oppShield' // 相手のシールド(攻撃)
  | 'oppPlayer' // 相手プレイヤー(ダイレクトアタック)
  | `oppCreature:${string}`; // 相手の特定クリーチャー(攻撃)

/** ドラッグ中の状態 */
export interface DragState {
  instId: string;
  from: ZoneId;
  /** 指やカーソルの現在位置(ドラッグ中のカードを追従表示するため) */
  pointer: { x: number; y: number };
  /** 現在重なっているドロップ先。無効な場所ならnull。 */
  hoveredDropZone: DropZoneId | null;
}

/**
 * 長押しで開く詳細表示。表示専用で、ゲーム状態を一切変更しない。
 *
 * シールドと山札は非公開情報のため、ここには含めない
 * (中身が見えるとゲームが成立しなくなるため意図的に除外している)。
 */
export type Inspect =
  | { kind: 'card'; cardId: string; instId?: string }
  | { kind: 'zone'; seat: Seat; zone: 'battleZone' | 'mana' | 'graveyard' };

/** 背景フィールドの種類 */
export type FieldId =
  | 'plain' // 草原
  | 'coast' // 海岸
  | 'mountain' // 山岳
  | 'flower' // 花畑
  | 'snow' // 雪原
  | 'autumn' // 紅葉
  | 'ruins' // 古代遺跡
  | 'skyIsland'; // 空島

/** 背景の選び方 */
export type BackgroundMode =
  | 'random' // 試合開始時にランダムで決定し、その試合中は変えない
  | 'fixed' // 選んだものに固定
  | 'off'; // 背景なし(単色)

export interface BackgroundSetting {
  mode: BackgroundMode;
  /** mode === 'fixed' の時に使う */
  fixedField: FieldId;
  /** 実際に今表示している背景 */
  currentField: FieldId;
}

export interface UIState {
  /** 選択中のカード。青い発光枠が付く。 */
  selectedInstId: string | null;
  /** 確認待ちの操作 */
  pendingAction: PendingAction | null;
  drag: DragState | null;
  /** 長押しで開いている詳細 */
  inspect: Inspect | null;
  /** ログ全文を開いているか */
  logOpen: boolean;
  background: BackgroundSetting;
}
