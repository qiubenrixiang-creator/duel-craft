/**
 * クリーチャーを重ねる仕組みの処理。
 *
 * 進化・侵略はいずれも「既にいるクリーチャーの上にカードを置く」形を取り、
 * 下に重なったカードは understack に積まれる。
 * 革命チェンジだけは重ねずに「入れ替える」点が異なる。
 *
 * 総合ルール801(進化クリーチャー)の要点:
 *   - 適正な進化元がなければバトルゾーンに出せない
 *   - 進化クリーチャーは召喚酔いしない
 *   - タップ状態は進化前のものを引き継ぐ
 *   - 破壊される時は、下に重なったカードもまとめて墓地に置かれる
 */

import type { Card, CardInstance, RaceCivCondition } from '../../types/card';
import type { PlayerState } from '../../types/game';
import { getCard, getCardCivilizations } from '../../cards/cardPool';

/**
 * 種族・文明の条件を満たすか判定する。
 * 進化元・革命チェンジ元・侵略元の判定で共通して使う。
 *
 * race はカンマ区切りで複数指定でき、いずれかに一致すればよい。
 * 条件が未設定の項目は「問わない」として扱う。
 */
export function meetsRaceCivCondition(
  condition: RaceCivCondition | undefined,
  targetCard: Card | undefined
): boolean {
  if (!condition) return false;
  if (!targetCard) return false;

  if (condition.civilization) {
    if (!getCardCivilizations(targetCard).includes(condition.civilization)) {
      return false;
    }
  }

  const requiredRaces = (condition.race ?? '')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);

  if (requiredRaces.length > 0) {
    const targetRaces = (targetCard.race ?? '').split(',').map((r) => r.trim());
    if (!requiredRaces.some((r) => targetRaces.includes(r))) return false;
  }
  return true;
}

/** 進化元にできる自分のクリーチャーを列挙する */
export function evolutionTargets(
  player: PlayerState,
  pool: Card[],
  evolutionCard: Card
): CardInstance[] {
  const condition = evolutionCard.keywords.evolutionFrom;
  return player.battleZone.filter(
    (c) =>
      c.kind === 'creature' &&
      meetsRaceCivCondition(condition, getCard(pool, c.cardId))
  );
}

/**
 * 革命チェンジ／侵略の起点にできる、攻撃中のクリーチャーを列挙する。
 * どちらも「攻撃する時」に手札から使う能力なので、
 * 攻撃可能な(タップされておらず召喚酔いもない)クリーチャーが対象。
 */
export function transformableAttackers(
  player: PlayerState,
  pool: Card[],
  handCard: Card,
  mode: 'revolutionChange' | 'invasion'
): CardInstance[] {
  const condition =
    mode === 'invasion'
      ? handCard.keywords.invasion
      : handCard.keywords.revolutionChange;

  return player.battleZone.filter((c) => {
    if (c.kind !== 'creature' || c.tapped || c.sick) return false;
    return meetsRaceCivCondition(condition, getCard(pool, c.cardId));
  });
}

/**
 * 進化・侵略でカードを重ねる。
 * 下にあったカードの id が understack に積まれ、召喚酔いは解除される。
 */
export function stackOnto(
  base: CardInstance,
  newCardId: string,
  turnNumber: number,
  justDiver: boolean
): void {
  base.understack = [...base.understack, base.cardId];
  base.cardId = newCardId;
  base.sick = false; // 進化・侵略したクリーチャーは召喚酔いしない
  base.enteredTurn = turnNumber;
  base.justDiverActive = justDiver;
  // tapped は意図的に引き継ぐ(総合ルール801)
}

/**
 * 革命チェンジで入れ替える。
 * 重ねるのではなく、元のクリーチャーは手札に戻る。
 */
export function swapWithHand(
  base: CardInstance,
  newCardId: string,
  turnNumber: number,
  justDiver: boolean
): string {
  const returnedCardId = base.cardId;
  base.cardId = newCardId;
  base.understack = [];
  base.sick = false;
  base.enteredTurn = turnNumber;
  base.justDiverActive = justDiver;
  return returnedCardId;
}

/**
 * クリーチャーを墓地に送る。
 * 進化・侵略で重なっていたカードも、まとめて墓地に置かれる(総合ルール801)。
 * また、そのクリーチャーに装備されていたクロスギアは装備先を失う。
 */
export function sendToGraveyard(
  player: PlayerState,
  creature: CardInstance,
  makeInstId: () => string
): void {
  const allCardIds = [...creature.understack, creature.cardId];
  for (const cardId of allCardIds) {
    player.graveyard.push(createGraveyardEntry(makeInstId(), cardId));
  }
  for (const other of player.battleZone) {
    if (other.kind === 'gear' && other.equippedTo === creature.instId) {
      other.equippedTo = null;
    }
  }
  player.battleZone = player.battleZone.filter(
    (c) => c.instId !== creature.instId
  );
}

/**
 * クリーチャーを手札に戻す。
 *
 * 進化・侵略で重なっている場合は、一番上のカードだけが手札に戻り、
 * 下に重なっていたカードが改めてバトルゾーンのクリーチャーになる
 * (総合ルール801.4「再構築」)。
 */
export function returnToHand(
  player: PlayerState,
  creature: CardInstance,
  makeInstId: () => string
): void {
  const returnedCardId = creature.cardId;

  if (creature.understack.length > 0) {
    const stack = [...creature.understack];
    creature.cardId = stack.pop() as string;
    creature.understack = stack;
  } else {
    for (const other of player.battleZone) {
      if (other.kind === 'gear' && other.equippedTo === creature.instId) {
        other.equippedTo = null;
      }
    }
    player.battleZone = player.battleZone.filter(
      (c) => c.instId !== creature.instId
    );
  }

  player.hand.push(createHandEntry(makeInstId(), returnedCardId));
}

/** 墓地に置くカード実体を作る(場に出ていないので状態は初期値) */
function createGraveyardEntry(instId: string, cardId: string): CardInstance {
  return blankInstance(instId, cardId);
}

/** 手札に加えるカード実体を作る */
function createHandEntry(instId: string, cardId: string): CardInstance {
  return blankInstance(instId, cardId);
}

/** バトルゾーン外に置かれるカードの初期状態 */
export function blankInstance(instId: string, cardId: string): CardInstance {
  return {
    instId,
    cardId,
    tapped: false,
    sick: false,
    kind: 'creature',
    understack: [],
    equippedTo: null,
    powerMod: 0,
    enteredTurn: 0,
    justDiverActive: false,
    cannotAttackThisTurn: false,
  };
}
