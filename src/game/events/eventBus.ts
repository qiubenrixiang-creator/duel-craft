/**
 * イベントの発行と、それに反応する効果の解決。
 *
 * ゲーム進行側は「イベントを発行する」だけでよく、
 * どのカードがどう反応するかを知る必要がない。
 *
 *   例: クリーチャーを召喚したら emitEvent(state, {type:'onSummon', ...}) を呼ぶ。
 *       そのカードが onSummon の効果を持っていれば自動的に解決される。
 */

import type { Card, CardEffect } from '../../types/card';
import type { GameState, PendingAbilityChoice, Seat } from '../../types/game';
import type { GameEvent } from './eventTypes';
import { isTriggerableEvent } from './eventTypes';
import { effectRegistry } from '../effects/effectRegistry';
import {
  CHOSEN_TARGETS,
  CREATURE_TARGETING_EFFECTS,
  type EffectContext,
} from '../effects/effectContext';
import { getCard } from '../../cards/cardPool';

/** 効果が「プレイヤーによる対象選択」を必要とするか */
export function requiresChoice(effect: CardEffect): boolean {
  const needsTarget = (CREATURE_TARGETING_EFFECTS as readonly string[]).includes(
    effect.effect
  );
  const isChosen = (CHOSEN_TARGETS as readonly string[]).includes(effect.target);
  return needsTarget && isChosen;
}

/** 1つの効果を即座に解決する(対象選択が不要なもの) */
export function applyEffect(
  state: GameState,
  seat: Seat,
  effect: CardEffect,
  pool: Card[],
  chosenTarget: EffectContext['chosenTarget'],
  makeInstId: () => string
): void {
  const handler = effectRegistry[effect.effect];
  if (!handler) return;

  const oppSeat: Seat = seat === 'p1' ? 'p2' : 'p1';
  const ctx: EffectContext = {
    state,
    seat,
    oppSeat,
    effect,
    value: Math.max(1, effect.value ?? 1),
    pool,
    chosenTarget,
    makeInstId,
    log: (text) =>
      state.log.push({
        turn: state.turnNumber,
        seat,
        kind: 'effect',
        text,
      }),
  };
  handler(ctx);
}

/**
 * イベントを発行し、該当する効果をすべて解決する。
 *
 * 対象選択が必要な効果は、その場では解決せずキューに積む。
 * プレイヤーが選択を終えると resolveChoice が呼ばれ、順に解決される。
 *
 * state は呼び出し側で複製済みであることを前提に、直接書き換える。
 */
export function emitEvent(
  state: GameState,
  event: GameEvent,
  pool: Card[],
  makeInstId: () => string
): void {
  if (!isTriggerableEvent(event.type)) return;

  const card = getCard(pool, event.sourceCardId);
  if (!card) return;

  const effects = collectEffects(card, event);
  const pendingChoices: PendingAbilityChoice[] = [];

  for (const effect of effects) {
    if (effect.trigger !== event.type) continue;

    if (requiresChoice(effect)) {
      pendingChoices.push({
        seat: event.seat,
        ability: effect,
        sourceName: card.name,
      });
    } else {
      applyEffect(state, event.seat, effect, pool, null, makeInstId);
    }
  }

  if (pendingChoices.length > 0) {
    enqueueChoices(state, pendingChoices);
  }
}

/**
 * カードから、そのイベントで参照すべき効果一覧を取り出す。
 * ツインパクトは使った面の効果だけを見る。
 */
function collectEffects(card: Card, event: GameEvent): CardEffect[] {
  if (card.type === 'twinpact' && event.side === 'spell') {
    return card.spellSide?.effects ?? [];
  }
  return card.effects ?? [];
}

/** 対象選択待ちをキューに積む */
export function enqueueChoices(
  state: GameState,
  choices: PendingAbilityChoice[]
): void {
  if (choices.length === 0) return;

  if (state.pendingAbilityChoice) {
    state.pendingAbilityChoiceQueue.push(...choices);
    return;
  }
  state.pendingAbilityChoice = choices[0];
  state.pendingAbilityChoiceQueue.push(...choices.slice(1));
  state.log.push({
    turn: state.turnNumber,
    seat: choices[0].seat,
    kind: 'effect',
    text: `「${choices[0].sourceName}」の能力: 対象を選んでください。`,
  });
}

/**
 * プレイヤーが対象を選んだあとの解決。
 *
 * 対象指定(自分限定/相手限定)に反する選択は、UIをすり抜けた場合でも
 * ここで弾く。
 */
export function resolveChoice(
  state: GameState,
  callerSeat: Seat,
  chosenInstId: string,
  pool: Card[],
  makeInstId: () => string
): void {
  const pending = state.pendingAbilityChoice;
  if (!pending || pending.seat !== callerSeat) return;

  const own = state.players[pending.seat];
  const oppSeat: Seat = pending.seat === 'p1' ? 'p2' : 'p1';
  const opp = state.players[oppSeat];

  const chosen =
    own.battleZone.find((c) => c.instId === chosenInstId && c.kind === 'creature') ??
    opp.battleZone.find((c) => c.instId === chosenInstId && c.kind === 'creature') ??
    null;

  if (chosen) {
    const isOwn = own.battleZone.some((c) => c.instId === chosenInstId);
    const target = pending.ability.target;
    const valid =
      (target !== 'chosenOwn' || isOwn) && (target !== 'chosenOpponent' || !isOwn);

    if (valid) {
      applyEffect(state, pending.seat, pending.ability, pool, chosen, makeInstId);
    }
  }

  // 次の選択待ちへ進む
  const queue = state.pendingAbilityChoiceQueue;
  if (queue.length > 0) {
    state.pendingAbilityChoice = queue.shift() ?? null;
    if (state.pendingAbilityChoice) {
      state.log.push({
        turn: state.turnNumber,
        seat: state.pendingAbilityChoice.seat,
        kind: 'effect',
        text: `続けて「${state.pendingAbilityChoice.sourceName}」の能力: 対象を選んでください。`,
      });
    }
  } else {
    state.pendingAbilityChoice = null;
  }
}
