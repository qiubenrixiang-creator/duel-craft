/**
 * ゲーム中に発生するイベントの定義。
 *
 * カードの効果は「どのイベントで発火するか」を持っており、
 * ゲーム進行中に該当イベントが発行されると自動的に解決される。
 *
 * この仕組みにより、新しい効果を足すときは
 *   1. handlers/ にファイルを1つ追加
 *   2. effectRegistry に1行登録
 * だけで済み、進行処理そのものには一切手を入れなくてよい。
 */

import type { EventType, CardInstance } from '../../types/card';
import type { Seat } from '../../types/game';

/** カード作成画面で選べるイベントの一覧(表示順) */
export const EVENT_TYPES: EventType[] = [
  'onSummon',
  'onAttack',
  'onBlock',
  'onTurnStart',
  'onTurnEnd',
  'onDestroy',
  'onShieldBreak',
  'onManaPlaced',
  'onDiscard',
  'static',
];

export const EVENT_LABEL: Record<EventType, string> = {
  onSummon: '出た時 / 使った時',
  onAttack: '攻撃する時',
  onBlock: 'ブロックした時',
  onTurnStart: 'ターン開始時',
  onTurnEnd: 'ターン終了時',
  onDestroy: '破壊された時',
  onShieldBreak: 'シールドをブレイクした時',
  onManaPlaced: 'マナゾーンに置かれた時',
  onDiscard: '手札から捨てられた時',
  static: '常在(常に有効)',
};

/**
 * 発行されるイベント。
 *
 * source は「この効果を持っているカード」を指す。
 * どのカードの能力として解決するかを特定するために必要。
 */
export interface GameEvent {
  type: EventType;
  /** 能力の持ち主(効果を及ぼす側) */
  seat: Seat;
  /** 能力を持つカードの実体。手札から使った呪文など、場にない場合もある。 */
  source?: CardInstance;
  /** 能力を持つカードのid */
  sourceCardId: string;
  /** ツインパクトの場合、どちらの面として使ったか */
  side?: 'creature' | 'spell';
}

/**
 * 常在能力は「発火」しない。
 * パワー計算などの場面で都度参照されるため、イベントとしては扱わない。
 */
export function isTriggerableEvent(type: EventType): boolean {
  return type !== 'static';
}
