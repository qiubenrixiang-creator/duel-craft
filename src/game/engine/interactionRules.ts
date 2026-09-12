/**
 * プレイヤーの操作(タップ／ドラッグ)が今この状況で有効かを判定する。
 *
 * ここは「操作できるかどうか」の判定に徹し、実際にゲーム状態を変更しない。
 * 変更は engine 側のアクション関数が行う。
 *
 * この分離により:
 *   - UIは「ドラッグ先を光らせるか」をここに聞くだけでよい
 *   - 確認画面のメッセージもここで生成できる
 *   - 判定ロジックが1か所にまとまり、UIとエンジンで食い違わない
 */

import type { Card, CardInstance } from '../../types/card';
import type { GameState, Seat } from '../../types/game';
import type { DropZoneId, PendingAction } from '../../types/ui';
import { canAttack, canChargeMana, canPlayCard } from './phaseSystem';
import { canAffordCard, effectiveCost } from './manaSystem';
import { getCard } from '../../cards/cardPool';
import { canAttackWith, validAttackTargets } from './combatSystem';

/** 手札のカードをドラッグできるか */
export function canDragFromHand(state: GameState, seat: Seat): boolean {
  if (state.turn !== seat) return false;
  return canPlayCard(state) || canChargeMana(state);
}

/** バトルゾーンのクリーチャーをドラッグできるか(攻撃のため) */
export function canDragFromBattle(
  state: GameState,
  seat: Seat,
  inst: CardInstance,
  card: Card | undefined
): boolean {
  if (state.turn !== seat) return false;
  if (!canAttack(state)) return false;
  return canAttackWith(state, seat, inst, card);
}

/**
 * ドラッグ中のカードを、指定のドロップ先に落とせるか。
 * UIはこれを使って、有効なドロップ先だけを光らせる。
 */
export function canDropOn(
  state: GameState,
  seat: Seat,
  pool: Card[],
  instId: string,
  from: 'hand' | 'battleZone',
  dropZone: DropZoneId
): boolean {
  const player = state.players[seat];

  if (from === 'hand') {
    const inst = player.hand.find((c) => c.instId === instId);
    if (!inst) return false;
    const card = getCard(pool, inst.cardId);
    if (!card) return false;

    if (dropZone === 'ownMana') {
      return canChargeMana(state);
    }
    if (dropZone === 'ownBattle') {
      if (!canPlayCard(state)) return false;
      return canAffordCard(player.mana, pool, card.civilizations, effectiveCost(card));
    }
    return false;
  }

  // バトルゾーンからのドラッグ = 攻撃
  const inst = player.battleZone.find((c) => c.instId === instId);
  if (!inst) return false;
  const card = getCard(pool, inst.cardId);
  if (!canDragFromBattle(state, seat, inst, card)) return false;

  const targets = validAttackTargets(state, seat, inst, card, pool);
  if (dropZone === 'oppShield') return targets.canAttackShield;
  if (dropZone === 'oppPlayer') return targets.canAttackDirect;
  if (dropZone.startsWith('oppCreature:')) {
    const targetId = dropZone.slice('oppCreature:'.length);
    return targets.attackableCreatureIds.includes(targetId);
  }
  return false;
}

/**
 * ドロップ結果を、確認待ちの操作(PendingAction)に変換する。
 * ここで返した内容が確認バーに表示され、決定を押すと実行される。
 */
export function dropToPendingAction(
  instId: string,
  from: 'hand' | 'battleZone',
  dropZone: DropZoneId
): PendingAction | null {
  if (from === 'hand') {
    if (dropZone === 'ownMana') return { type: 'charge', instId };
    if (dropZone === 'ownBattle') return { type: 'summon', instId };
    return null;
  }
  if (dropZone === 'oppShield') {
    return { type: 'attack', attackerInstId: instId, targetType: 'shield' };
  }
  if (dropZone === 'oppPlayer') {
    return { type: 'attack', attackerInstId: instId, targetType: 'direct' };
  }
  if (dropZone.startsWith('oppCreature:')) {
    return {
      type: 'attack',
      attackerInstId: instId,
      targetType: 'creature',
      targetCreatureInstId: dropZone.slice('oppCreature:'.length),
    };
  }
  return null;
}

/**
 * 確認バーに出す文言を作る。
 * 「何が起きるか」を具体的に書くことで、誤操作に気づけるようにする。
 */
export function describePendingAction(
  action: PendingAction,
  state: GameState,
  seat: Seat,
  pool: Card[]
): string {
  const player = state.players[seat];
  const oppSeat: Seat = seat === 'p1' ? 'p2' : 'p1';

  const nameOf = (instId: string, zone: CardInstance[]): string => {
    const inst = zone.find((c) => c.instId === instId);
    return inst ? getCard(pool, inst.cardId)?.name ?? 'カード' : 'カード';
  };

  switch (action.type) {
    case 'charge':
      return `「${nameOf(action.instId, player.hand)}」をマナゾーンに置きます。`;
    case 'summon': {
      const name = nameOf(action.instId, player.hand);
      if (action.side === 'spell') return `「${name}」の呪文面を唱えます。`;
      return `「${name}」を召喚します。`;
    }
    case 'equip':
      return `クロスギアを「${nameOf(
        action.creatureInstId,
        player.battleZone
      )}」に装備します。`;
    case 'attack': {
      const attacker = nameOf(action.attackerInstId, player.battleZone);
      if (action.targetType === 'shield') {
        return `「${attacker}」でシールドを攻撃します。`;
      }
      if (action.targetType === 'direct') {
        return `「${attacker}」でダイレクトアタックします。勝敗が決まります。`;
      }
      const target = action.targetCreatureInstId
        ? nameOf(action.targetCreatureInstId, state.players[oppSeat].battleZone)
        : 'クリーチャー';
      return `「${attacker}」で「${target}」を攻撃します。`;
    }
    case 'endTurn':
      return 'ターンを終了します。';
    case 'toMainPhase':
      return 'メインステップに進みます。以降このターンはマナチャージできません。';
    case 'toAttackPhase':
      return '攻撃ステップに進みます。';
  }
}
