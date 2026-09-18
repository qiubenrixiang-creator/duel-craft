/**
 * 効果ハンドラの共通インターフェースと、対象(target)の解決処理。
 *
 * 個々の効果(ドロー、破壊など)は handlers/ 以下に1ファイルずつ置き、
 * すべてこの EffectHandler の形をとる。
 */

import type { Card, CardEffect, CardInstance } from '../../types/card';
import type { GameState, PlayerState, Seat } from '../../types/game';
import { getCard } from '../../cards/cardPool';

/** 効果を解決するときに渡される文脈 */
export interface EffectContext {
  /** 書き換えてよい状態(呼び出し側で複製済み) */
  state: GameState;
  /** 効果の持ち主 */
  seat: Seat;
  /** 相手 */
  oppSeat: Seat;
  /** 解決する効果 */
  effect: CardEffect;
  /** 効果の数値。未指定なら1。 */
  value: number;
  pool: Card[];
  /** 「選んだ1体」で既に選択済みの対象。未選択ならnull。 */
  chosenTarget: CardInstance | null;
  /** カード実体のidを新しく発行する */
  makeInstId: () => string;
  /** ログを1行追加する */
  log: (text: string) => void;
}

/**
 * 効果ハンドラ。
 * state を直接書き換える(呼び出し側で複製済みのため安全)。
 */
export type EffectHandler = (ctx: EffectContext) => void;

/**
 * 「選んだ1体」を対象に取る効果かどうか。
 * これに該当する場合、解決前にプレイヤーへ対象選択を求める。
 */
export const CHOSEN_TARGETS = ['chosen', 'chosenOwn', 'chosenOpponent'] as const;

/** クリーチャーを対象に取る効果(選択が必要になりうるもの) */
export const CREATURE_TARGETING_EFFECTS = [
  'destroy',
  'powerUp',
  'powerDown',
  'toMana',
  'bounce',
  'tap',
  'untap',
  'preventAttack',
] as const;

/** 対象になったクリーチャーと、その持ち主 */
export interface TargetedCreature {
  creature: CardInstance;
  owner: PlayerState;
  ownerSeat: Seat;
}

/**
 * 効果の対象になるクリーチャーを解決する。
 *
 * ジャストダイバーを持つ相手クリーチャーは、相手の能力の対象にならないため
 * ここで除外される(自分の能力の対象にはなる)。
 */
export function resolveCreatureTargets(ctx: EffectContext): TargetedCreature[] {
  const { state, seat, oppSeat, effect, value, chosenTarget } = ctx;
  const own = state.players[seat];
  const opp = state.players[oppSeat];

  const tag = (list: CardInstance[], s: Seat): TargetedCreature[] =>
    list.map((creature) => ({ creature, owner: state.players[s], ownerSeat: s }));

  const ownCreatures = own.battleZone.filter((c) => c.kind === 'creature');
  // 相手のジャストダイバー中のクリーチャーは対象に取れない
  const oppCreatures = opp.battleZone.filter(
    (c) => c.kind === 'creature' && !c.justDiverActive
  );

  // 既に選択済みならそれだけを対象にする
  if (chosenTarget) {
    const isOwn = own.battleZone.some((c) => c.instId === chosenTarget.instId);
    return [
      {
        creature: chosenTarget,
        owner: isOwn ? own : opp,
        ownerSeat: isOwn ? seat : oppSeat,
      },
    ];
  }

  switch (effect.target) {
    case 'self':
    case 'ownCreatures':
      return tag(ownCreatures, seat);
    case 'opponent':
    case 'opponentCreatures':
      return tag(oppCreatures, oppSeat);
    case 'ownRandom':
      return tag(pickRandom(ownCreatures, value), seat);
    case 'opponentRandom':
      return tag(pickRandom(oppCreatures, value), oppSeat);
    case 'all':
      return [...tag(ownCreatures, seat), ...tag(oppCreatures, oppSeat)];
    default:
      return [];
  }
}

/**
 * プレイヤーを対象に取る効果(ドロー、手札を捨てるなど)で、
 * どちらのプレイヤーが対象かを返す。
 */
export function resolveTargetPlayer(ctx: EffectContext): {
  player: PlayerState;
  playerSeat: Seat;
} {
  const isOpponent = ctx.effect.target === 'opponent';
  const playerSeat = isOpponent ? ctx.oppSeat : ctx.seat;
  return { player: ctx.state.players[playerSeat], playerSeat };
}

/** 配列からランダムにn件取り出す */
function pickRandom<T>(list: T[], n: number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/** カード名を引く(ログ用) */
export function cardName(pool: Card[], cardId: string): string {
  return getCard(pool, cardId)?.name ?? 'カード';
}
