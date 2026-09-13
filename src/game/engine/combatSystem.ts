/**
 * 戦闘に関する処理。
 *
 * パワーの算出、ブレイク数の決定、攻撃可否と攻撃対象の判定を扱う。
 * 実際に破壊やシールドブレイクを行う処理は gameEngine 側にあり、
 * ここは「計算と判定」に徹する。
 */

import type { Card, CardInstance } from '../../types/card';
import type { GameState, PlayerState, Seat } from '../../types/game';
import { getCard } from '../../cards/cardPool';

/**
 * クリーチャーの現在のパワー。
 * 素のパワー + 効果による増減 + 装備クロスギア + 常在効果 を合算する。
 */
export function getEffectivePower(
  player: PlayerState,
  pool: Card[],
  creature: CardInstance
): number {
  const card = getCard(pool, creature.cardId);
  let power = card?.power ?? 0;
  power += creature.powerMod ?? 0;

  for (const other of player.battleZone) {
    // 装備されているクロスギアのパワー上昇
    if (other.kind === 'gear' && other.equippedTo === creature.instId) {
      power += getCard(pool, other.cardId)?.powerBonus ?? 0;
    }
    // 常在効果によるパワー増減
    if (other.kind === 'creature') {
      const otherCard = getCard(pool, other.cardId);
      for (const eff of otherCard?.effects ?? []) {
        if (eff.trigger !== 'static') continue;
        if (eff.effect !== 'powerUp' && eff.effect !== 'powerDown') continue;
        const amount = Math.max(1, eff.value ?? 1);
        const delta = eff.effect === 'powerUp' ? amount : -amount;
        if (eff.target === 'self' && other.instId === creature.instId) {
          power += delta;
        } else if (eff.target === 'ownCreatures' || eff.target === 'all') {
          power += delta;
        }
      }
    }
  }
  return power;
}

/**
 * 攻撃時のパワー。
 * パワーアタッカーは「攻撃する時」のみ加算され、ブロックする側には適用されない。
 */
export function getAttackPower(
  player: PlayerState,
  pool: Card[],
  creature: CardInstance
): number {
  const base = getEffectivePower(player, pool, creature);
  const card = getCard(pool, creature.cardId);
  return base + (card?.keywords.powerAttacker ?? 0);
}

/**
 * ブレイクするシールドの枚数を求める(総合ルール509.2)。
 * パワード・ブレイカーはパワー6000ごとに1枚追加される。
 */
export function getBreakCount(
  card: Card | undefined,
  attackPower: number,
  availableShields: number
): number {
  const type = card?.keywords.breakerType;
  let count = 1;
  if (type === 'world') count = availableShields;
  else if (type === 'Q') count = 4;
  else if (type === 'T') count = 3;
  else if (type === 'W') count = 2;

  if (card?.keywords.poweredBreaker) {
    count += Math.floor(attackPower / 6000);
  }
  return Math.min(count, availableShields);
}

/** そのクリーチャーが今攻撃できるか */
export function canAttackWith(
  state: GameState,
  seat: Seat,
  creature: CardInstance,
  card: Card | undefined
): boolean {
  if (state.winner) return false;
  if (state.turn !== seat) return false;
  if (creature.kind !== 'creature') return false;
  if (creature.tapped) return false;
  if (creature.cannotAttackThisTurn) return false;
  // 召喚酔い。スピードアタッカーは出たターンから攻撃できる。
  if (creature.sick && !card?.keywords.speedAttacker) return false;
  return true;
}

/** 攻撃可能な対象の一覧 */
export interface AttackTargets {
  canAttackShield: boolean;
  canAttackDirect: boolean;
  /** 攻撃できる相手クリーチャーの instId */
  attackableCreatureIds: string[];
}

/**
 * 攻撃できる対象を求める。
 *
 * 通常、攻撃できるのはタップされている相手クリーチャーのみ。
 * マッハファイターを持つクリーチャーは、出たターンに限り
 * アンタップ状態の相手クリーチャーも攻撃できる。
 */
export function validAttackTargets(
  state: GameState,
  seat: Seat,
  creature: CardInstance,
  card: Card | undefined
): AttackTargets {
  const oppSeat: Seat = seat === 'p1' ? 'p2' : 'p1';
  const opponent = state.players[oppSeat];

  const machFighterActive =
    Boolean(card?.keywords.machFighter) && creature.enteredTurn === state.turnNumber;

  const attackableCreatureIds = opponent.battleZone
    .filter((c) => c.kind === 'creature')
    .filter((c) => c.tapped || machFighterActive)
    .map((c) => c.instId);

  return {
    canAttackShield: opponent.shields.length > 0,
    canAttackDirect: opponent.shields.length === 0,
    attackableCreatureIds,
  };
}

/**
 * 攻撃に対してブロックできるクリーチャーを求める。
 * ブロッカーを持ち、まだタップされていないものが対象。
 * 攻撃側が「ブロックされない」を持つ場合は誰もブロックできない。
 */
export function validBlockers(
  defender: PlayerState,
  pool: Card[],
  attackerCard: Card | undefined
): CardInstance[] {
  if (attackerCard?.keywords.cannotBeBlocked) return [];
  return defender.battleZone.filter((c) => {
    if (c.kind !== 'creature' || c.tapped) return false;
    return Boolean(getCard(pool, c.cardId)?.keywords.blocker);
  });
}

/** バトルの結果。どちらが破壊されるかを表す。 */
export interface BattleResult {
  destroyAttacker: boolean;
  destroyDefender: boolean;
}

/**
 * バトルの勝敗を判定する。
 * パワーが高い方が勝ち、同数なら相打ち。
 * スレイヤーを持つ側は、負けても相手を道連れにする。
 */
export function resolveBattle(
  attackPower: number,
  defenderPower: number,
  attackerCard: Card | undefined,
  defenderCard: Card | undefined
): BattleResult {
  let destroyAttacker = false;
  let destroyDefender = false;

  if (attackPower > defenderPower) destroyDefender = true;
  else if (attackPower < defenderPower) destroyAttacker = true;
  else {
    destroyAttacker = true;
    destroyDefender = true;
  }

  if (attackerCard?.keywords.slayer) destroyDefender = true;
  if (defenderCard?.keywords.slayer) destroyAttacker = true;

  return { destroyAttacker, destroyDefender };
}
