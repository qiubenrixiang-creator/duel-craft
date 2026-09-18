/**
 * フェーズ進行の管理。
 *
 * 公式ルールのターン構造(501〜505)に沿う:
 *   501 ターン開始ステップ … アンタップ、「ターンのはじめに」の能力
 *   502 ドローステップ     … 1枚引く(ターン起因処理)
 *   503 マナチャージステップ … 手札から1枚マナゾーンへ置ける(任意)
 *   504 メインステップ     … カードを使える
 *   505 攻撃ステップ       … 攻撃する
 *
 * 501・502は自動処理なので、プレイヤーが意識するのは mana / main / attack の3つ。
 */

import type { GameState, Phase } from '../../types/game';

/** プレイヤーが操作する3つのフェーズを、進行順に並べたもの */
export const PLAYER_PHASES: Phase[] = ['mana', 'main', 'attack'];

export const PHASE_LABEL: Record<Phase, string> = {
  draw: 'ドロー',
  mana: 'マナ',
  main: 'メイン',
  attack: '攻撃',
};

/**
 * 今この状態で、指定フェーズへ進めるか。
 *
 * ルール上、マナチャージは「メインより前」にしか行えないため、
 * 一度 main へ進んだら mana へは戻れない。
 * 一方 main と attack は行き来できる(攻撃をやめてカードを使う、という判断ができる)。
 */
export function canMoveToPhase(state: GameState, to: Phase): boolean {
  if (state.winner) return false;
  if (hasPendingInterrupt(state)) return false;

  const from = state.phase;
  if (from === to) return false;

  // マナへ戻ることはできない(公式ルール503はメインより前の1回のみ)
  if (to === 'mana') return false;
  // ドローは自動処理なので手動で移動しない
  if (to === 'draw') return false;

  if (to === 'main') return from === 'mana' || from === 'attack';
  if (to === 'attack') return from === 'mana' || from === 'main';
  return false;
}

/**
 * 割り込み処理(S・トリガー、ブロック、対象選択)が待機中かどうか。
 * 待機中は通常の操作を一切受け付けない。
 */
export function hasPendingInterrupt(state: GameState): boolean {
  return Boolean(
    state.pendingTrigger || state.pendingBlock || state.pendingAbilityChoice
  );
}

/** 現在のフェーズでマナチャージが可能か(公式ルール503) */
export function canChargeMana(state: GameState): boolean {
  if (state.winner || hasPendingInterrupt(state)) return false;
  return state.phase === 'mana' && !state.manaChargedThisTurn;
}

/** 現在のフェーズでカードを使えるか(公式ルール504.1) */
export function canPlayCard(state: GameState): boolean {
  if (state.winner || hasPendingInterrupt(state)) return false;
  return state.phase === 'main';
}

/** 現在のフェーズで攻撃できるか(公式ルール505) */
export function canAttack(state: GameState): boolean {
  if (state.winner || hasPendingInterrupt(state)) return false;
  return state.phase === 'attack';
}

/**
 * フェーズを進める。
 * ゲーム状態を直接書き換えるのではなく、呼び出し側が結果を受け取る形にする。
 */
export function moveToPhase(state: GameState, to: Phase): GameState {
  if (!canMoveToPhase(state, to)) return state;
  return { ...state, phase: to };
}
