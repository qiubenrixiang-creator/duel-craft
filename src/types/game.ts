/**
 * ゲームの進行状態に関する型定義。
 *
 * ここで定義する GameState は「対戦の全情報」であり、通信で相手と同期する対象。
 * 選択中のカードやドラッグ中の位置といった各端末固有の情報は含めない
 * (それらは types/ui.ts の UIState で扱う)。
 */

import type { CardEffect, CardInstance } from './card';

/** 座席。p1が先に部屋を作った側。 */
export type Seat = 'p1' | 'p2';

/**
 * ターン内のフェーズ。
 * 公式ルール(501〜505)の進行に合わせている:
 *   ターン開始(アンタップ) → ドロー → マナチャージ → メイン → 攻撃
 *
 * draw は自動処理のため、プレイヤーが操作するのは mana / main / attack の3つ。
 * main と attack は行き来できる(誤って攻撃に進んでも戻れる)が、
 * 一度 main に進んだらマナチャージはできない(公式ルール503準拠)。
 */
export type Phase = 'draw' | 'mana' | 'main' | 'attack';

/** カードが存在しうる場所 */
export type ZoneId = 'hand' | 'deck' | 'shields' | 'mana' | 'battleZone' | 'graveyard';

/** 片方のプレイヤーが持つすべてのゾーン */
export interface PlayerState {
  name: string;
  deck: CardInstance[];
  hand: CardInstance[];
  shields: CardInstance[];
  mana: CardInstance[];
  battleZone: CardInstance[];
  graveyard: CardInstance[];
}

/** 攻撃の対象種別 */
export type AttackTargetType =
  | 'shield' // シールドを攻撃
  | 'direct' // プレイヤーを直接攻撃(相手のシールドが0枚の時のみ)
  | 'creature'; // 相手のクリーチャーを攻撃

/**
 * シールドから公開されたカードの発動確認待ち。
 * S・トリガーとG・ストライクは発動タイミングが同じなので同じ仕組みで扱う。
 */
export interface PendingTrigger {
  owner: Seat;
  inst: CardInstance;
  /** 'gStrike' の場合はG・ストライクとして解決する */
  special?: 'gStrike';
}

/** ブロックするかどうかの確認待ち */
export interface PendingBlock {
  attackerSeat: Seat;
  attackerInstId: string;
  targetType: AttackTargetType;
  defenderSeat: Seat;
}

/** 「選んだ1体」を対象に取る効果の、対象選択待ち */
export interface PendingAbilityChoice {
  seat: Seat;
  ability: CardEffect;
  sourceName: string;
}

/**
 * ログ1件。
 * 単なる文字列ではなく構造体にすることで、種類ごとの色分けや
 * 「効果だけ絞り込む」といった表示ができる。
 */
export interface LogEntry {
  turn: number;
  /** システムメッセージなど、プレイヤーに紐づかない場合は null */
  seat: Seat | null;
  kind: 'play' | 'attack' | 'effect' | 'phase' | 'system';
  text: string;
}

/** 対戦の全状態。これがそのまま通信で同期される。 */
export interface GameState {
  turn: Seat;
  turnNumber: number;
  phase: Phase;
  /** そのターンすでにマナチャージしたか(公式ルール503.2: 通常1ターンに1枚) */
  manaChargedThisTurn: boolean;
  winner: Seat | null;
  log: LogEntry[];
  players: Record<Seat, PlayerState>;

  /** 以下は「割り込み処理」。いずれかが非nullの間は通常操作を受け付けない。 */
  pendingTrigger: PendingTrigger | null;
  pendingTriggerQueue: PendingTrigger[];
  pendingBlock: PendingBlock | null;
  pendingAbilityChoice: PendingAbilityChoice | null;
  pendingAbilityChoiceQueue: PendingAbilityChoice[];
}

/** 対戦開始時に各プレイヤーが持ち込む情報 */
export interface PlayerSetup {
  name: string;
  deckCardIds: string[];
}
