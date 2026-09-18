/**
 * 対戦進行の統括。
 *
 * UIから呼ばれる操作(召喚・マナチャージ・攻撃など)をここにまとめる。
 * どの関数も「現在の状態を受け取り、新しい状態を返す」形にしており、
 * 元の状態は書き換えない。こうすることで、
 *   - 通信で送る状態が明確になる
 *   - 操作前の状態に戻すのが容易になる
 *
 * ルールの判定そのものは engine/ の各ファイルに委ね、
 * ここは「手順の組み立て」に徹する。
 */

import type { Card, CardInstance } from '../../types/card';
import type {
  AttackTargetType,
  GameState,
  LogEntry,
  PlayerSetup,
  PlayerState,
  Seat,
} from '../../types/game';
import { getCard, getCardCivilizations, isMulticolor } from '../../cards/cardPool';
import {
  applyManaPayment,
  computeManaPayment,
  effectiveCost,
} from './manaSystem';
import {
  getAttackPower,
  getBreakCount,
  getEffectivePower,
  resolveBattle,
  validBlockers,
} from './combatSystem';
import {
  evolutionTargets,
  returnToHand,
  sendToGraveyard,
  stackOnto,
  swapWithHand,
  blankInstance,
  meetsRaceCivCondition,
} from './evolutionSystem';
import { emitEvent, resolveChoice } from '../events/eventBus';
import { hasPendingInterrupt } from './phaseSystem';

/* ===== 補助 ===== */

let idCounter = 0;

/** カード実体のidを発行する */
export function makeInstId(): string {
  idCounter += 1;
  return `i${Date.now().toString(36)}${idCounter.toString(36)}`;
}

/** 状態を複製する(書き換え前に必ず通す) */
function clone(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/** ログを1行追加する */
function log(
  state: GameState,
  kind: LogEntry['kind'],
  text: string,
  seat: Seat | null = null
): void {
  state.log.push({ turn: state.turnNumber, seat, kind, text });
  // 増えすぎないよう直近だけ残す
  if (state.log.length > 60) state.log = state.log.slice(-60);
}

function other(seat: Seat): Seat {
  return seat === 'p1' ? 'p2' : 'p1';
}

/** 配列をシャッフルする */
function shuffle<T>(list: T[]): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/* ===== ゲーム開始 ===== */

/**
 * 対戦の初期状態を作る。
 *
 * 通信対戦では、両者が別々にシャッフルすると手札が食い違うため、
 * 片方(p1)だけがこれを実行し、結果を相手へ送る。
 */
export function createGame(p1: PlayerSetup, p2: PlayerSetup): GameState {
  const build = (setup: PlayerSetup): PlayerState => {
    const deck = shuffle(setup.deckCardIds).map((cardId) =>
      blankInstance(makeInstId(), cardId)
    );
    return {
      name: setup.name,
      shields: deck.slice(0, 5),
      hand: deck.slice(5, 10),
      deck: deck.slice(10),
      mana: [],
      battleZone: [],
      graveyard: [],
    };
  };

  const first: Seat = Math.random() < 0.5 ? 'p1' : 'p2';
  const players = { p1: build(p1), p2: build(p2) };

  const state: GameState = {
    turn: first,
    turnNumber: 1,
    // 最初のターンはドローを飛ばす(先攻の有利が大きくなりすぎるため)
    phase: 'mana',
    manaChargedThisTurn: false,
    winner: null,
    log: [],
    players,
    pendingTrigger: null,
    pendingTriggerQueue: [],
    pendingBlock: null,
    pendingAbilityChoice: null,
    pendingAbilityChoiceQueue: [],
  };

  log(state, 'system', `対戦開始。先攻は ${players[first].name}。`);
  return state;
}

/* ===== カードを引く ===== */

/** 1枚引く。山札が尽きたら引けなかった側の負け。 */
function drawOne(state: GameState, seat: Seat): void {
  const player = state.players[seat];
  if (player.deck.length === 0) {
    state.winner = other(seat);
    log(state, 'system', `${player.name} は山札が尽き、敗北した。`, seat);
    return;
  }
  const card = player.deck.shift();
  if (card) player.hand.push(card);
}

/* ===== マナチャージ ===== */

/**
 * 手札のカードをマナゾーンに置く。
 * 多色カードはタップして置かれる(総合ルール405.1)。
 */
export function chargeMana(
  state: GameState,
  seat: Seat,
  instId: string,
  pool: Card[]
): GameState {
  const s = clone(state);
  if (s.winner || hasPendingInterrupt(s)) return state;
  if (s.turn !== seat || s.phase !== 'mana' || s.manaChargedThisTurn) return state;

  const player = s.players[seat];
  const index = player.hand.findIndex((c) => c.instId === instId);
  if (index === -1) return state;

  const [inst] = player.hand.splice(index, 1);
  const card = getCard(pool, inst.cardId);
  const multi = isMulticolor(card);

  player.mana.push({ ...inst, tapped: multi });
  s.manaChargedThisTurn = true;

  log(
    s,
    'play',
    multi
      ? `${player.name} が「${card?.name}」をマナゾーンに置いた(多色のためタップ)。`
      : `${player.name} が「${card?.name}」をマナゾーンに置いた。`,
    seat
  );

  // マナゾーンに置かれた時の効果
  if (card) {
    emitEvent(
      s,
      { type: 'onManaPlaced', seat, sourceCardId: card.id, source: inst },
      pool,
      makeInstId
    );
  }
  return s;
}

/* ===== カードを使う ===== */

export interface PlayOptions {
  /** ツインパクトでどちらの面を使うか */
  side?: 'creature' | 'spell';
  /** 進化クリーチャーの進化元 */
  evolveTargetInstId?: string;
}

/**
 * 手札からカードを使う(召喚・呪文・クロスギア)。
 * コストは自動で支払われる。
 */
export function playCard(
  state: GameState,
  seat: Seat,
  instId: string,
  pool: Card[],
  options: PlayOptions = {}
): GameState {
  const s = clone(state);
  if (s.winner || hasPendingInterrupt(s)) return state;
  if (s.turn !== seat || s.phase !== 'main') return state;

  const player = s.players[seat];
  const index = player.hand.findIndex((c) => c.instId === instId);
  if (index === -1) return state;

  const inst = player.hand[index];
  const card = getCard(pool, inst.cardId);
  if (!card) return state;

  const side = card.type === 'twinpact' ? options.side ?? 'creature' : undefined;
  const cost = effectiveCost(card, side);
  const civs = getCardCivilizations(card);

  // 進化クリーチャーは、先に進化元を確かめる
  let evolveTarget: CardInstance | undefined;
  if (card.type === 'evolution') {
    evolveTarget = player.battleZone.find(
      (c) => c.instId === options.evolveTargetInstId && c.kind === 'creature'
    );
    if (!evolveTarget) {
      log(s, 'system', `適正な進化元がないため「${card.name}」を出せない。`, seat);
      return s;
    }
  }

  // コストを支払う
  const payment = computeManaPayment(player.mana, pool, civs, cost);
  if (!payment) {
    log(s, 'system', `マナが足りないため「${card.name}」を使えない。`, seat);
    return s;
  }
  applyManaPayment(player.mana, payment);
  player.hand.splice(index, 1);

  const effectiveType = side ?? card.type;

  if (effectiveType === 'creature') {
    player.battleZone.push({
      ...inst,
      tapped: false,
      sick: !card.keywords.speedAttacker,
      kind: 'creature',
      enteredTurn: s.turnNumber,
      justDiverActive: Boolean(card.keywords.justDiver),
    });
    log(s, 'play', `${player.name} が「${card.name}」を召喚した。`, seat);
  } else if (effectiveType === 'crossGear') {
    player.battleZone.push({ ...inst, tapped: false, kind: 'gear', equippedTo: null });
    log(s, 'play', `${player.name} がクロスギア「${card.name}」を出した。`, seat);
  } else if (effectiveType === 'evolution' && evolveTarget) {
    stackOnto(
      evolveTarget,
      card.id,
      s.turnNumber,
      Boolean(card.keywords.justDiver)
    );
    log(s, 'play', `${player.name} が「${card.name}」に進化した。`, seat);
  } else {
    // 呪文は使用後に墓地へ
    player.graveyard.push(blankInstance(makeInstId(), inst.cardId));
    log(s, 'play', `${player.name} が呪文「${card.name}」を唱えた。`, seat);
  }

  emitEvent(
    s,
    { type: 'onSummon', seat, sourceCardId: card.id, source: inst, side },
    pool,
    makeInstId
  );
  return s;
}

/** クロスギアをクリーチャーに装備する */
export function equipGear(
  state: GameState,
  seat: Seat,
  gearInstId: string,
  creatureInstId: string,
  pool: Card[]
): GameState {
  const s = clone(state);
  if (s.winner || hasPendingInterrupt(s) || s.turn !== seat) return state;

  const player = s.players[seat];
  const gear = player.battleZone.find(
    (c) => c.instId === gearInstId && c.kind === 'gear'
  );
  const creature = player.battleZone.find(
    (c) => c.instId === creatureInstId && c.kind === 'creature'
  );
  if (!gear || !creature) return state;

  gear.equippedTo = creatureInstId;
  const gearCard = getCard(pool, gear.cardId);
  const creatureCard = getCard(pool, creature.cardId);
  log(
    s,
    'play',
    `${player.name} が「${gearCard?.name}」を「${creatureCard?.name}」に装備した。`,
    seat
  );
  return s;
}

/* ===== 攻撃 ===== */

export interface AttackOptions {
  targetCreatureInstId?: string;
  /** 革命チェンジ・侵略で入れ替える手札のカード */
  transformHandInstId?: string;
  transformMode?: 'revolutionChange' | 'invasion';
}

/**
 * 攻撃を宣言する。
 *
 * ブロッカーがいる場合は、ここで止まって相手のブロック選択を待つ。
 * いない場合はそのまま攻撃を解決する。
 */
export function declareAttack(
  state: GameState,
  seat: Seat,
  attackerInstId: string,
  targetType: AttackTargetType,
  pool: Card[],
  options: AttackOptions = {}
): GameState {
  const s = clone(state);
  if (s.winner || hasPendingInterrupt(s)) return state;
  if (s.turn !== seat || s.phase !== 'attack') return state;

  const player = s.players[seat];
  const oppSeat = other(seat);
  const opponent = s.players[oppSeat];

  const attacker = player.battleZone.find((c) => c.instId === attackerInstId);
  if (!attacker || attacker.tapped || attacker.cannotAttackThisTurn) return state;

  let attackerCard = getCard(pool, attacker.cardId);
  if (attacker.sick && !attackerCard?.keywords.speedAttacker) return state;

  // 革命チェンジ・侵略(コストを支払わず入れ替える)
  if (options.transformHandInstId && options.transformMode) {
    const handIndex = player.hand.findIndex(
      (c) => c.instId === options.transformHandInstId
    );
    if (handIndex !== -1) {
      const handInst = player.hand[handIndex];
      const handCard = getCard(pool, handInst.cardId);
      const condition =
        options.transformMode === 'invasion'
          ? handCard?.keywords.invasion
          : handCard?.keywords.revolutionChange;

      if (handCard && meetsRaceCivCondition(condition, attackerCard)) {
        player.hand.splice(handIndex, 1);
        if (options.transformMode === 'invasion') {
          stackOnto(
            attacker,
            handCard.id,
            s.turnNumber,
            Boolean(handCard.keywords.justDiver)
          );
          log(s, 'play', `${player.name} が「${handCard.name}」で侵略した。`, seat);
        } else {
          const returned = swapWithHand(
            attacker,
            handCard.id,
            s.turnNumber,
            Boolean(handCard.keywords.justDiver)
          );
          player.hand.push(blankInstance(makeInstId(), returned));
          log(
            s,
            'play',
            `${player.name} が「${handCard.name}」に革命チェンジした。`,
            seat
          );
        }
        attackerCard = handCard;
      }
    }
  }

  // マッハファイターは攻撃してもタップしない、わけではない。
  // (出たターンにアンタップのクリーチャーも攻撃できる能力であり、タップは通常通り)
  attacker.tapped = true;

  emitEvent(
    s,
    { type: 'onAttack', seat, sourceCardId: attacker.cardId, source: attacker },
    pool,
    makeInstId
  );

  // クリーチャーへの攻撃はブロックされない
  if (targetType === 'creature') {
    return resolveCreatureBattle(
      s,
      seat,
      attackerInstId,
      options.targetCreatureInstId ?? '',
      pool
    );
  }

  // ブロッカーがいれば相手の判断を待つ
  const blockers = validBlockers(opponent, pool, attackerCard);
  if (blockers.length > 0) {
    s.pendingBlock = {
      attackerSeat: seat,
      attackerInstId,
      targetType,
      defenderSeat: oppSeat,
    };
    log(
      s,
      'attack',
      `${player.name} の「${attackerCard?.name}」が攻撃。${opponent.name} はブロックを選べます。`,
      seat
    );
    return s;
  }

  return resolveAttack(s, seat, attackerInstId, targetType, pool);
}

/** ブロックする */
export function declareBlock(
  state: GameState,
  seat: Seat,
  blockerInstId: string,
  pool: Card[]
): GameState {
  const s = clone(state);
  const pending = s.pendingBlock;
  if (!pending || pending.defenderSeat !== seat) return state;

  const defender = s.players[seat];
  const attackerPlayer = s.players[pending.attackerSeat];
  const blocker = defender.battleZone.find((c) => c.instId === blockerInstId);
  const attacker = attackerPlayer.battleZone.find(
    (c) => c.instId === pending.attackerInstId
  );
  if (!blocker || !attacker) return state;

  const blockerCard = getCard(pool, blocker.cardId);
  const attackerCard = getCard(pool, attacker.cardId);
  if (!blockerCard?.keywords.blocker) return state;

  blocker.tapped = true;
  s.pendingBlock = null;
  log(s, 'attack', `${defender.name} の「${blockerCard.name}」がブロックした。`, seat);

  emitEvent(
    s,
    { type: 'onBlock', seat, sourceCardId: blocker.cardId, source: blocker },
    pool,
    makeInstId
  );

  const atkPower = getAttackPower(attackerPlayer, pool, attacker);
  const defPower = getEffectivePower(defender, pool, blocker);
  const result = resolveBattle(atkPower, defPower, attackerCard, blockerCard);

  if (result.destroyAttacker) {
    destroyCreature(s, pending.attackerSeat, attacker, pool);
  }
  if (result.destroyDefender) {
    destroyCreature(s, seat, blocker, pool);
  }
  return s;
}

/** ブロックしない */
export function declineBlock(
  state: GameState,
  seat: Seat,
  pool: Card[]
): GameState {
  const s = clone(state);
  const pending = s.pendingBlock;
  if (!pending || pending.defenderSeat !== seat) return state;

  s.pendingBlock = null;
  log(s, 'attack', `${s.players[seat].name} はブロックしなかった。`, seat);
  return resolveAttack(
    s,
    pending.attackerSeat,
    pending.attackerInstId,
    pending.targetType,
    pool
  );
}

/** シールドブレイクまたはダイレクトアタックを解決する */
function resolveAttack(
  s: GameState,
  seat: Seat,
  attackerInstId: string,
  targetType: AttackTargetType,
  pool: Card[]
): GameState {
  const player = s.players[seat];
  const oppSeat = other(seat);
  const opponent = s.players[oppSeat];

  const attacker = player.battleZone.find((c) => c.instId === attackerInstId);
  const card = attacker ? getCard(pool, attacker.cardId) : undefined;

  if (targetType === 'direct') {
    s.winner = seat;
    log(s, 'attack', `${player.name} のダイレクトアタック。${player.name} の勝利。`, seat);
    return s;
  }

  if (!attacker) return s;

  const attackPower = getAttackPower(player, pool, attacker);
  const breakCount = getBreakCount(card, attackPower, opponent.shields.length);

  const broken: CardInstance[] = [];
  for (let i = 0; i < breakCount; i++) {
    const index = Math.floor(Math.random() * opponent.shields.length);
    const [shield] = opponent.shields.splice(index, 1);
    if (shield) broken.push(shield);
  }

  log(
    s,
    'attack',
    `${player.name} の「${card?.name}」がシールドを${broken.length}枚ブレイク(残り${opponent.shields.length})。`,
    seat
  );

  emitEvent(
    s,
    { type: 'onShieldBreak', seat, sourceCardId: attacker.cardId, source: attacker },
    pool,
    makeInstId
  );

  // ブレイクしたシールドのうち、S・トリガー/G・ストライクは発動を選べる
  const queue = [];
  for (const shield of broken) {
    const shieldCard = getCard(pool, shield.cardId);
    if (shieldCard?.keywords.gStrike) {
      queue.push({ owner: oppSeat, inst: shield, special: 'gStrike' as const });
      log(s, 'effect', `G・ストライク「${shieldCard.name}」が公開された。`, oppSeat);
    } else if (shieldCard?.keywords.shieldTrigger) {
      queue.push({ owner: oppSeat, inst: shield });
      log(s, 'effect', `S・トリガー「${shieldCard.name}」が公開された。`, oppSeat);
    } else {
      opponent.hand.push(shield);
    }
  }

  if (queue.length > 0) {
    s.pendingTrigger = queue[0];
    s.pendingTriggerQueue = queue.slice(1);
  }
  return s;
}

/** クリーチャー同士のバトルを解決する */
function resolveCreatureBattle(
  s: GameState,
  seat: Seat,
  attackerInstId: string,
  targetInstId: string,
  pool: Card[]
): GameState {
  const player = s.players[seat];
  const oppSeat = other(seat);
  const opponent = s.players[oppSeat];

  const attacker = player.battleZone.find((c) => c.instId === attackerInstId);
  const target = opponent.battleZone.find((c) => c.instId === targetInstId);
  if (!attacker || !target) return s;

  const attackerCard = getCard(pool, attacker.cardId);
  const targetCard = getCard(pool, target.cardId);

  const atkPower = getAttackPower(player, pool, attacker);
  const defPower = getEffectivePower(opponent, pool, target);
  const result = resolveBattle(atkPower, defPower, attackerCard, targetCard);

  log(
    s,
    'attack',
    `${player.name} の「${attackerCard?.name}」が「${targetCard?.name}」を攻撃。`,
    seat
  );

  if (result.destroyAttacker) destroyCreature(s, seat, attacker, pool);
  if (result.destroyDefender) destroyCreature(s, oppSeat, target, pool);
  return s;
}

/**
 * クリーチャーを破壊する。
 * エスケープを持つ場合は、破壊のかわりにシールドを1枚手札に加える。
 */
function destroyCreature(
  s: GameState,
  seat: Seat,
  creature: CardInstance,
  pool: Card[]
): void {
  const player = s.players[seat];
  const card = getCard(pool, creature.cardId);

  if (card?.keywords.escape && player.shields.length > 0) {
    player.battleZone.forEach((c) => {
      if (c.kind === 'gear' && c.equippedTo === creature.instId) c.equippedTo = null;
    });
    player.battleZone = player.battleZone.filter(
      (c) => c.instId !== creature.instId
    );
    const index = Math.floor(Math.random() * player.shields.length);
    const [shield] = player.shields.splice(index, 1);
    if (shield) player.hand.push(shield);
    log(
      s,
      'effect',
      `「${card.name}」がエスケープ。シールドを1枚手札に加えた。`,
      seat
    );
    return;
  }

  sendToGraveyard(player, creature, makeInstId);
  log(s, 'effect', `「${card?.name}」が破壊された。`, seat);

  if (card) {
    emitEvent(
      s,
      { type: 'onDestroy', seat, sourceCardId: card.id, source: creature },
      pool,
      makeInstId
    );
  }
}

/* ===== S・トリガー / G・ストライク ===== */

/** 公開されたカードを使うか決める */
export function resolveTrigger(
  state: GameState,
  seat: Seat,
  use: boolean,
  pool: Card[]
): GameState {
  const s = clone(state);
  const pending = s.pendingTrigger;
  if (!pending || pending.owner !== seat) return state;

  const player = s.players[seat];
  const card = getCard(pool, pending.inst.cardId);

  if (!use || !card) {
    player.hand.push(pending.inst);
    log(s, 'effect', `${player.name} は発動せず手札に加えた。`, seat);
  } else if (pending.special === 'gStrike') {
    // G・ストライクは手札に加えたうえで、相手のクリーチャー1体を攻撃できなくする
    player.hand.push(pending.inst);
    log(s, 'effect', `${player.name} がG・ストライクを発動した。`, seat);
    const ability = {
      trigger: 'onSummon' as const,
      effect: 'preventAttack' as const,
      target: 'chosenOpponent' as const,
      value: 1,
    };
    s.pendingAbilityChoice = { seat, ability, sourceName: card.name };
  } else if (card.type === 'creature' || card.type === 'evolution') {
    player.battleZone.push({
      ...pending.inst,
      tapped: false,
      sick: !card.keywords.speedAttacker,
      kind: 'creature',
      enteredTurn: s.turnNumber,
      justDiverActive: Boolean(card.keywords.justDiver),
    });
    log(s, 'effect', `${player.name} がS・トリガーで「${card.name}」を出した。`, seat);
    emitEvent(
      s,
      { type: 'onSummon', seat, sourceCardId: card.id, source: pending.inst },
      pool,
      makeInstId
    );
  } else {
    player.graveyard.push(blankInstance(makeInstId(), pending.inst.cardId));
    log(s, 'effect', `${player.name} がS・トリガーで「${card.name}」を唱えた。`, seat);
    emitEvent(
      s,
      {
        type: 'onSummon',
        seat,
        sourceCardId: card.id,
        source: pending.inst,
        side: card.type === 'twinpact' ? 'spell' : undefined,
      },
      pool,
      makeInstId
    );
  }

  // 次の公開カードへ
  if (s.pendingTriggerQueue.length > 0) {
    s.pendingTrigger = s.pendingTriggerQueue.shift() ?? null;
  } else {
    s.pendingTrigger = null;
  }
  return s;
}

/** 能力の対象を選ぶ */
export function chooseAbilityTarget(
  state: GameState,
  seat: Seat,
  instId: string,
  pool: Card[]
): GameState {
  const s = clone(state);
  resolveChoice(s, seat, instId, pool, makeInstId);
  return s;
}

/* ===== フェーズ・ターン ===== */

/** フェーズを進める */
export function changePhase(
  state: GameState,
  seat: Seat,
  to: 'main' | 'attack'
): GameState {
  const s = clone(state);
  if (s.winner || hasPendingInterrupt(s) || s.turn !== seat) return state;
  if (s.phase === to) return state;
  // マナフェーズへは戻れない(公式ルール503)
  if (s.phase === 'main' && to === 'main') return state;

  s.phase = to;
  log(s, 'phase', to === 'main' ? 'メインステップ' : '攻撃ステップ', seat);
  return s;
}

/**
 * ターンを終了し、相手のターンを始める。
 *
 * ターン開始時の処理(アンタップ→ドロー)もここで行う。
 */
export function endTurn(state: GameState, seat: Seat, pool: Card[]): GameState {
  const s = clone(state);
  if (s.winner || hasPendingInterrupt(s) || s.turn !== seat) return state;

  // 終了時の効果
  for (const creature of s.players[seat].battleZone) {
    if (creature.kind !== 'creature') continue;
    emitEvent(
      s,
      { type: 'onTurnEnd', seat, sourceCardId: creature.cardId, source: creature },
      pool,
      makeInstId
    );
  }

  const next = other(seat);
  s.turn = next;
  s.turnNumber += 1;
  s.manaChargedThisTurn = false;
  s.phase = 'mana';

  // アンタップ(公式ルール501)
  const nextPlayer = s.players[next];
  nextPlayer.mana.forEach((m) => (m.tapped = false));
  nextPlayer.battleZone.forEach((c) => {
    c.tapped = false;
    c.sick = false;
    c.justDiverActive = false;
    c.cannotAttackThisTurn = false;
  });

  log(s, 'phase', `${nextPlayer.name} のターン。`, next);

  // ドロー(公式ルール502)
  drawOne(s, next);
  if (s.winner) return s;

  // 開始時の効果
  for (const creature of s.players[next].battleZone) {
    if (creature.kind !== 'creature') continue;
    emitEvent(
      s,
      {
        type: 'onTurnStart',
        seat: next,
        sourceCardId: creature.cardId,
        source: creature,
      },
      pool,
      makeInstId
    );
  }
  return s;
}

/* ===== 判定の補助(UI向け) ===== */

/** 今この手札のカードを使えるか */
export function canPlayFromHand(
  state: GameState,
  seat: Seat,
  inst: CardInstance,
  pool: Card[]
): boolean {
  if (state.turn !== seat || state.phase !== 'main') return false;
  if (hasPendingInterrupt(state)) return false;

  const card = getCard(pool, inst.cardId);
  if (!card) return false;

  const player = state.players[seat];
  const cost = effectiveCost(card);
  const civs = getCardCivilizations(card);

  if (!computeManaPayment(player.mana, pool, civs, cost)) return false;

  // 進化クリーチャーは進化元が必要
  if (card.type === 'evolution') {
    return evolutionTargets(player, pool, card).length > 0;
  }
  return true;
}

/** 今このクリーチャーで攻撃できるか */
export function canAttackWithCreature(
  state: GameState,
  seat: Seat,
  inst: CardInstance,
  pool: Card[]
): boolean {
  if (state.turn !== seat || state.phase !== 'attack') return false;
  if (hasPendingInterrupt(state)) return false;
  if (inst.kind !== 'creature' || inst.tapped || inst.cannotAttackThisTurn) {
    return false;
  }
  const card = getCard(pool, inst.cardId);
  if (inst.sick && !card?.keywords.speedAttacker) return false;
  return true;
}
