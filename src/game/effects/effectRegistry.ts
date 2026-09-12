/**
 * 効果の登録表。
 *
 * ここが「効果を追加するときに触る唯一の場所」になる。
 *
 * 新しい効果を追加する手順:
 *   1. types/card.ts の EffectType に識別子を足す
 *   2. handlers/ に処理を書く
 *   3. 下の effectRegistry に1行足す
 *   4. EFFECT_LABEL に表示名を足す
 *
 * 進行処理(gameEngine)には一切手を入れなくてよい。
 */

import type { EffectType } from '../../types/card';
import type { EffectHandler } from './effectContext';
import {
  addShieldHandler,
  discardHandler,
  drawHandler,
  manaAccelHandler,
  reviveHandler,
} from './handlers/playerEffects';
import {
  addBreakerHandler,
  bounceHandler,
  destroyHandler,
  powerChangeHandler,
  preventAttackHandler,
  tapHandler,
  toManaHandler,
  untapHandler,
} from './handlers/creatureEffects';

/**
 * toMana は対象によって挙動が変わる:
 *   対象がプレイヤー → 山札の上からマナに置く(マナ加速)
 *   対象がクリーチャー → そのクリーチャーをマナに置く
 * そのため、両方を試す薄いラッパーを噛ませている。
 */
const toManaDispatch: EffectHandler = (ctx) => {
  const isPlayerTarget =
    ctx.effect.target === 'self' || ctx.effect.target === 'opponent';
  if (isPlayerTarget) manaAccelHandler(ctx);
  else toManaHandler(ctx);
};

export const effectRegistry: Record<EffectType, EffectHandler> = {
  draw: drawHandler,
  discard: discardHandler,
  addShield: addShieldHandler,
  reviveFromGraveyard: reviveHandler,
  toMana: toManaDispatch,

  destroy: destroyHandler,
  powerUp: powerChangeHandler,
  powerDown: powerChangeHandler,
  bounce: bounceHandler,
  tap: tapHandler,
  untap: untapHandler,
  preventAttack: preventAttackHandler,
  addBreaker: addBreakerHandler,
};

/** カード作成画面に表示する効果の一覧(表示順) */
export const EFFECT_TYPES: EffectType[] = [
  'draw',
  'discard',
  'destroy',
  'powerUp',
  'powerDown',
  'toMana',
  'addShield',
  'addBreaker',
  'bounce',
  'reviveFromGraveyard',
  'tap',
  'untap',
  'preventAttack',
];

export const EFFECT_LABEL: Record<EffectType, string> = {
  draw: 'カードを引く',
  discard: '手札を捨てる',
  destroy: 'クリーチャーを破壊する',
  powerUp: 'パワーを上げる',
  powerDown: 'パワーを下げる',
  toMana: 'マナゾーンへ置く',
  addShield: 'シールドを追加する',
  addBreaker: 'シールドブレイク数を追加する(常在)',
  bounce: '手札に戻す',
  reviveFromGraveyard: '墓地のクリーチャーを手札に戻す',
  tap: 'タップする',
  untap: 'アンタップする',
  preventAttack: 'このターン攻撃できなくする',
};

/** 数値の指定が必要な効果 */
export const VALUE_REQUIRED_EFFECTS: EffectType[] = [
  'draw',
  'discard',
  'powerUp',
  'powerDown',
  'toMana',
  'addShield',
  'addBreaker',
  'reviveFromGraveyard',
];
