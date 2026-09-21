/**
 * 対戦画面。
 *
 * ここまでに作った部品(ゾーン・ターンバー・モーダル)と
 * ゲームエンジンを繋ぎ、実際に遊べる状態にする。
 *
 * 【操作の流れ】
 *   タップ   … カードを選ぶ → 行き先を選ぶ → 確認 → 実行
 *   ドラッグ … カードを掴んで置きたい場所へ運ぶ → 確認 → 実行
 *   長押し   … カードの効果／ゾーンの中身を見る(状態は変わらない)
 *
 * 確認を挟むのは、誤って攻撃したりマナに置いたりする事故を防ぐため。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Card, CardInstance } from '../types/card';
import type { GameState, Seat } from '../types/game';
import type { DropZoneId, FieldId, PendingAction } from '../types/ui';

import { BackgroundField, WeatherEffect } from '../components/BackgroundField';
import { BattleZone, DeckCounter, HandZone, ManaZone, ShieldZone } from '../components/Zones';
import { ActionButtons, GameLog, TurnBar } from '../components/TurnBar';
import { CardModal, ConfirmModal, Modal, ZoneModal } from '../components/Modals';
import { CardView } from '../components/CardView';

import {
  canAttackWithCreature,
  canPlayFromHand,
  changePhase,
  chargeMana,
  chooseAbilityTarget,
  declareAttack,
  declareBlock,
  declineBlock,
  endTurn,
  playCard,
  resolveTrigger,
} from '../game/engine/gameEngine';
import { validAttackTargets, validBlockers } from '../game/engine/combatSystem';
import { evolutionTargets } from '../game/engine/evolutionSystem';
import { getCard as lookupCard } from '../cards/cardPool';
import {
  computeScale,
  clipDiagonal,
  GLASS,
  INK,
  ACCENT,
  NEON,
} from '../ui/tokens';
import { playSE, startBgm, unlockAudio } from '../ui/sound';

export interface BattleScreenProps {
  state: GameState;
  /** 自分の席 */
  seat: Seat;
  pool: Card[];
  fieldId: FieldId;
  backgroundOff?: boolean;
  /** 操作した結果を渡す(通信対戦では相手にも送られる) */
  onStateChange: (next: GameState) => void;
  onExit: () => void;
}

export function BattleScreen({
  state,
  seat,
  pool,
  fieldId,
  backgroundOff,
  onStateChange,
  onExit,
}: BattleScreenProps) {
  const oppSeat: Seat = seat === 'p1' ? 'p2' : 'p1';
  const me = state.players[seat];
  const opponent = state.players[oppSeat];

  /* ===== 画面サイズに応じた拡大率 ===== */

  /**
   * window.innerHeight は、iOSのSafariでは画面下のツールバーに隠れる分まで
   * 含んだ値を返すため、当てにできない。
   * 実際に描画されている枠(rootRef)の大きさを測って使う。
   */
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1920,
    h: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });

  useEffect(() => {
    const measure = () => {
      const el = rootRef.current;
      const next =
        el && el.clientWidth > 0 && el.clientHeight > 0
          ? { w: el.clientWidth, h: el.clientHeight }
          : {
              w: window.visualViewport?.width ?? window.innerWidth,
              h: window.visualViewport?.height ?? window.innerHeight,
            };

      // 同じ値なら描き直さない(iOSは resize が頻繁に飛んでくるため)
      setViewport((prev) =>
        prev.w === next.w && prev.h === next.h ? prev : next
      );
    };

    measure();

    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (observer && rootRef.current) observer.observe(rootRef.current);

    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    // 回転直後は寸法が確定していないことがあるので、少し待ってもう一度測る
    const retry = setTimeout(measure, 350);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      clearTimeout(retry);
    };
    // 縦横が切り替わると枠そのものが差し替わるので、測り直しの対象も付け直す
    // (isPortrait はこの下で定義されるため、同じ条件をここで書いている)
  }, [viewport.h > viewport.w]);

  const scale = computeScale(viewport.w, viewport.h);
  const isPortrait = viewport.h > viewport.w;

  /* ===== 画面内の状態(通信では送らない) ===== */
  const [selectedInstId, setSelectedInstId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [inspectCard, setInspectCard] = useState<Card | null>(null);
  const [inspectZone, setInspectZone] = useState<{
    title: string;
    cards: { card: Card | undefined; instance: CardInstance }[];
    showCivSummary?: boolean;
  } | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [dragInstId, setDragInstId] = useState<string | null>(null);
  const [dragPoint, setDragPoint] = useState<{ x: number; y: number } | null>(null);
  const [hoverZone, setHoverZone] = useState<DropZoneId | null>(null);

  /** 対戦中はBGMを切り替える */
  useEffect(() => {
    startBgm('battle');
    unlockAudio();
  }, []);

  /** 勝敗が決まったら結果のBGMに切り替える */
  useEffect(() => {
    if (state.winner) startBgm('result');
  }, [state.winner]);

  const getCard = useCallback(
    (cardId: string) => lookupCard(pool, cardId),
    [pool]
  );

  /* ===== 今できることの判定 ===== */

  const isMyTurn = state.turn === seat && !state.winner;
  const interrupted = Boolean(
    state.pendingTrigger || state.pendingBlock || state.pendingAbilityChoice
  );
  const canOperate = isMyTurn && !interrupted && !state.winner;

  /** 手札のうち、今使えるカード */
  const playableIds = useMemo(() => {
    if (!canOperate) return [];
    if (state.phase === 'mana') {
      // マナフェーズはまだ置いていなければ全部置ける
      return state.manaChargedThisTurn ? [] : me.hand.map((c) => c.instId);
    }
    if (state.phase === 'main') {
      return me.hand
        .filter((inst) => canPlayFromHand(state, seat, inst, pool))
        .map((c) => c.instId);
    }
    return [];
  }, [state, seat, pool, me.hand, canOperate]);

  /** 攻撃できるクリーチャー */
  const attackableIds = useMemo(() => {
    if (!canOperate || state.phase !== 'attack') return [];
    return me.battleZone
      .filter((inst) => canAttackWithCreature(state, seat, inst, pool))
      .map((c) => c.instId);
  }, [state, seat, pool, me.battleZone, canOperate]);

  /** 選択中のクリーチャーが攻撃できる相手 */
  const targetableIds = useMemo(() => {
    if (!selectedInstId || state.phase !== 'attack') return [];
    const attacker = me.battleZone.find((c) => c.instId === selectedInstId);
    if (!attacker) return [];
    const card = getCard(attacker.cardId);
    return validAttackTargets(state, seat, attacker, card).attackableCreatureIds;
  }, [selectedInstId, state, seat, me.battleZone, getCard]);

  /* ===== 操作 ===== */

  /** 確認待ちにする */
  const requestAction = useCallback((action: PendingAction) => {
    playSE('uiClick');
    setPendingAction(action);
  }, []);

  /** 確認された操作を実行する */
  const commitAction = useCallback(() => {
    if (!pendingAction) return;
    let next = state;

    switch (pendingAction.type) {
      case 'charge':
        playSE('chargeMana');
        next = chargeMana(state, seat, pendingAction.instId, pool);
        break;
      case 'summon':
        playSE('cardPlay');
        next = playCard(state, seat, pendingAction.instId, pool, {
          side: pendingAction.side,
          evolveTargetInstId: pendingAction.evolveTargetInstId,
        });
        break;
      case 'attack':
        playSE('attack');
        next = declareAttack(
          state,
          seat,
          pendingAction.attackerInstId,
          pendingAction.targetType,
          pool,
          {
            targetCreatureInstId: pendingAction.targetCreatureInstId,
            transformHandInstId: pendingAction.transformHandInstId,
            transformMode: pendingAction.transformMode,
          }
        );
        break;
      case 'endTurn':
        playSE('turnEnd');
        next = endTurn(state, seat, pool);
        break;
      case 'toMainPhase':
        next = changePhase(state, seat, 'main');
        break;
      case 'toAttackPhase':
        next = changePhase(state, seat, 'attack');
        break;
    }

    setPendingAction(null);
    setSelectedInstId(null);
    onStateChange(next);
  }, [pendingAction, state, seat, pool, onStateChange]);

  const cancelAction = useCallback(() => {
    setPendingAction(null);
    setSelectedInstId(null);
    setDragInstId(null);
    setHoverZone(null);
  }, []);

  /** 手札をタップした時 */
  const onHandTap = useCallback(
    (inst: CardInstance) => {
      if (!canOperate) return;
      if (!playableIds.includes(inst.instId)) return;

      // マナフェーズなら、そのままマナに置く確認へ
      if (state.phase === 'mana') {
        requestAction({ type: 'charge', instId: inst.instId });
        return;
      }

      const card = getCard(inst.cardId);
      if (!card) return;

      // 進化クリーチャーは進化元を選ぶ必要がある
      if (card.type === 'evolution') {
        const targets = evolutionTargets(me, pool, card);
        if (targets.length === 1) {
          requestAction({
            type: 'summon',
            instId: inst.instId,
            evolveTargetInstId: targets[0].instId,
          });
        } else {
          // 複数ある場合は選択待ちにする
          setSelectedInstId(inst.instId);
        }
        return;
      }

      requestAction({ type: 'summon', instId: inst.instId });
    },
    [canOperate, playableIds, state.phase, getCard, me, pool, requestAction]
  );

  /** 自分のクリーチャーをタップした時 */
  const onOwnCreatureTap = useCallback(
    (inst: CardInstance) => {
      if (!canOperate) return;

      // 進化元を選んでいる最中
      const selectedHand = me.hand.find((c) => c.instId === selectedInstId);
      if (selectedHand) {
        const card = getCard(selectedHand.cardId);
        if (card?.type === 'evolution') {
          requestAction({
            type: 'summon',
            instId: selectedHand.instId,
            evolveTargetInstId: inst.instId,
          });
          return;
        }
      }

      if (state.phase !== 'attack') return;
      if (!attackableIds.includes(inst.instId)) return;

      // 攻撃するクリーチャーを選ぶ
      setSelectedInstId(inst.instId === selectedInstId ? null : inst.instId);
      playSE('uiClick');
    },
    [
      canOperate,
      me.hand,
      selectedInstId,
      getCard,
      state.phase,
      attackableIds,
      requestAction,
    ]
  );

  /** 相手のクリーチャーをタップした時(攻撃対象に選ぶ) */
  const onOppCreatureTap = useCallback(
    (inst: CardInstance) => {
      if (!selectedInstId || state.phase !== 'attack') return;
      if (!targetableIds.includes(inst.instId)) return;
      requestAction({
        type: 'attack',
        attackerInstId: selectedInstId,
        targetType: 'creature',
        targetCreatureInstId: inst.instId,
      });
    },
    [selectedInstId, state.phase, targetableIds, requestAction]
  );

  /** 相手のシールドを攻撃 */
  const onAttackShield = useCallback(() => {
    if (!selectedInstId) return;
    const direct = opponent.shields.length === 0;
    requestAction({
      type: 'attack',
      attackerInstId: selectedInstId,
      targetType: direct ? 'direct' : 'shield',
    });
  }, [selectedInstId, opponent.shields.length, requestAction]);

  /* ===== ドラッグ ===== */

  const onDragStart = useCallback(
    (inst: CardInstance, p: { x: number; y: number }) => {
      setDragInstId(inst.instId);
      setDragPoint(p);
    },
    []
  );

  const onDragMove = useCallback((p: { x: number; y: number }) => {
    setDragPoint(p);
    // 指の位置にある要素から、ドロップ先を判定する
    const el = document.elementFromPoint(p.x, p.y);
    const zone = el?.closest('[data-dropzone]')?.getAttribute('data-dropzone');
    setHoverZone((zone as DropZoneId) ?? null);
  }, []);

  const onDragEnd = useCallback(() => {
    const instId = dragInstId;
    const zone = hoverZone;
    setDragInstId(null);
    setDragPoint(null);
    setHoverZone(null);
    if (!instId || !zone) return;

    const fromHand = me.hand.some((c) => c.instId === instId);

    if (fromHand) {
      if (zone === 'ownMana' && state.phase === 'mana') {
        requestAction({ type: 'charge', instId });
      } else if (zone === 'ownBattle' && state.phase === 'main') {
        const inst = me.hand.find((c) => c.instId === instId);
        const card = inst ? getCard(inst.cardId) : undefined;
        if (card?.type === 'evolution') {
          const targets = evolutionTargets(me, pool, card);
          if (targets.length >= 1) {
            requestAction({
              type: 'summon',
              instId,
              evolveTargetInstId: targets[0].instId,
            });
          }
        } else {
          requestAction({ type: 'summon', instId });
        }
      }
      return;
    }

    // バトルゾーンからのドラッグ = 攻撃
    if (state.phase !== 'attack') return;
    if (zone === 'oppShield') {
      requestAction({
        type: 'attack',
        attackerInstId: instId,
        targetType: opponent.shields.length === 0 ? 'direct' : 'shield',
      });
    } else if (zone.startsWith('oppCreature:')) {
      requestAction({
        type: 'attack',
        attackerInstId: instId,
        targetType: 'creature',
        targetCreatureInstId: zone.slice('oppCreature:'.length),
      });
    }
  }, [
    dragInstId,
    hoverZone,
    me,
    state.phase,
    getCard,
    pool,
    opponent.shields.length,
    requestAction,
  ]);

  /* ===== 割り込みへの応答 ===== */

  const onTriggerChoice = useCallback(
    (use: boolean) => {
      playSE(use ? 'sTrigger' : 'uiClick');
      onStateChange(resolveTrigger(state, seat, use, pool));
    },
    [state, seat, pool, onStateChange]
  );

  const onBlockChoice = useCallback(
    (blockerInstId: string | null) => {
      playSE(blockerInstId ? 'block' : 'uiClick');
      onStateChange(
        blockerInstId
          ? declareBlock(state, seat, blockerInstId, pool)
          : declineBlock(state, seat, pool)
      );
    },
    [state, seat, pool, onStateChange]
  );

  const onAbilityTarget = useCallback(
    (instId: string) => {
      playSE('cardPlay');
      onStateChange(chooseAbilityTarget(state, seat, instId, pool));
    },
    [state, seat, pool, onStateChange]
  );

  /* ===== 描画 ===== */

  const zoneGrid = {
    display: 'grid',
    gridTemplateColumns: `${170 * scale}px 1fr ${430 * scale}px ${260 * scale}px`,
    gap: 14 * scale,
    minHeight: 0,
  } as const;

  // 縦持ちのときは案内だけを出す。
  // 外枠(rootRef)は常に描いておき、回転しても寸法を測り続けられるようにする。
  if (isPortrait) {
    return (
      <div
        ref={rootRef}
        className="dc-battle-root"
        style={{
          background: '#0B1020',
          color: INK.base,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 54,
            height: 54,
            border: '3px solid rgba(255,255,255,0.5)',
            borderRadius: 8,
          }}
        />
        <p style={{ fontSize: 15, fontWeight: 700 }}>端末を横向きにしてください</p>
        <p style={{ fontSize: 12, color: INK.dim }}>
          対戦画面は横画面で遊ぶように作られています
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="dc-battle-root">
      <BackgroundField fieldId={fieldId} disabled={backgroundOff} />
      <WeatherEffect fieldId={fieldId} disabled={backgroundOff} />

      <div
        style={{
          position: 'relative',
          zIndex: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: `0 ${40 * scale}px`,
        }}
      >
        {/* ===== 相手側 ===== */}
        <div style={{ ...zoneGrid, height: '31%', paddingTop: 14 * scale }}>
          <div data-dropzone="oppShield">
            <ShieldZone
              label="相手シールド"
              count={opponent.shields.length}
              scale={scale}
            />
          </div>

          <BattleZone
            label="相手バトルゾーン"
            instances={opponent.battleZone}
            getCard={getCard}
            scale={scale}
            targetableIds={targetableIds}
            onCardTap={onOppCreatureTap}
            onCardLongPress={setInspectCard}
            onZoneLongPress={() =>
              setInspectZone({
                title: '相手のバトルゾーン',
                cards: opponent.battleZone.map((i) => ({
                  card: getCard(i.cardId),
                  instance: i,
                })),
              })
            }
          />

          <ManaZone
            label="相手マナ"
            instances={opponent.mana}
            getCard={getCard}
            scale={scale}
            onCardLongPress={setInspectCard}
            onZoneLongPress={() =>
              setInspectZone({
                title: '相手のマナゾーン',
                cards: opponent.mana.map((i) => ({
                  card: getCard(i.cardId),
                  instance: i,
                })),
                showCivSummary: true,
              })
            }
          />

          <DeckCounter
            deckCount={opponent.deck.length}
            graveyardCount={opponent.graveyard.length}
            handCount={opponent.hand.length}
            scale={scale}
            onGraveyardLongPress={() =>
              setInspectZone({
                title: '相手の墓地',
                cards: opponent.graveyard.map((i) => ({
                  card: getCard(i.cardId),
                  instance: i,
                })),
              })
            }
          />
        </div>

        {/* ===== ターンバー ===== */}
        <TurnBar
          isMyTurn={isMyTurn}
          opponentName={opponent.name}
          turnNumber={state.turnNumber}
          phase={state.phase}
          lastLog={state.log[state.log.length - 1]}
          scale={scale}
          onLogTap={() => setLogOpen(true)}
          onExit={onExit}
        />

        {/* ===== 自分側 ===== */}
        <div style={{ ...zoneGrid, flex: 1, paddingBottom: 10 * scale }}>
          <ShieldZone
            label="自分シールド"
            count={me.shields.length}
            scale={scale}
          />

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6 * scale,
              minHeight: 0,
            }}
          >
            <div data-dropzone="ownBattle" style={{ display: 'flex', flex: 1, minHeight: 0 }}>
              <BattleZone
                label="自分バトルゾーン"
                instances={me.battleZone}
                getCard={getCard}
                scale={scale}
                selectedInstId={selectedInstId}
                actionableIds={attackableIds}
                highlighted={hoverZone === 'ownBattle'}
                draggingInstId={dragInstId}
                onCardTap={onOwnCreatureTap}
                onCardLongPress={setInspectCard}
                onCardDragStart={onDragStart}
                onCardDragMove={onDragMove}
                onCardDragEnd={onDragEnd}
                onZoneLongPress={() =>
                  setInspectZone({
                    title: '自分のバトルゾーン',
                    cards: me.battleZone.map((i) => ({
                      card: getCard(i.cardId),
                      instance: i,
                    })),
                  })
                }
              />
            </div>

            <HandZone
              instances={me.hand}
              getCard={getCard}
              scale={scale}
              playableIds={playableIds}
              selectedInstId={selectedInstId}
              draggingInstId={dragInstId}
              onCardTap={onHandTap}
              onCardLongPress={setInspectCard}
              onCardDragStart={onDragStart}
              onCardDragMove={onDragMove}
              onCardDragEnd={onDragEnd}
            />
          </div>

          <div data-dropzone="ownMana">
            <ManaZone
              label="自分マナ"
              instances={me.mana}
              getCard={getCard}
              scale={scale}
              highlighted={hoverZone === 'ownMana'}
              onCardLongPress={setInspectCard}
              onZoneLongPress={() =>
                setInspectZone({
                  title: '自分のマナゾーン',
                  cards: me.mana.map((i) => ({
                    card: getCard(i.cardId),
                    instance: i,
                  })),
                  showCivSummary: true,
                })
              }
            />
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <DeckCounter
              deckCount={me.deck.length}
              graveyardCount={me.graveyard.length}
              scale={scale}
              onGraveyardLongPress={() =>
                setInspectZone({
                  title: '自分の墓地',
                  cards: me.graveyard.map((i) => ({
                    card: getCard(i.cardId),
                    instance: i,
                  })),
                })
              }
            />

            {/* 攻撃対象を選んでいる時だけ、シールド攻撃のボタンを出す */}
            {selectedInstId && state.phase === 'attack' && (
              <button
                onClick={onAttackShield}
                style={{
                  marginTop: 8 * scale,
                  padding: `${10 * scale}px`,
                  border: 'none',
                  clipPath: clipDiagonal(Math.max(4, 9 * scale)),
                  background:
                    opponent.shields.length === 0
                      ? `linear-gradient(180deg,${ACCENT.danger},#B32643)`
                      : `linear-gradient(180deg,${ACCENT.navy},#062334)`,
                  boxShadow:
                    opponent.shields.length === 0
                      ? `0 0 ${14 * scale}px rgba(255,77,109,0.5)`
                      : `inset 0 0 0 1px ${NEON.dim}`,
                  color: opponent.shields.length === 0 ? '#FFF0F3' : NEON.bright,
                  fontWeight: 800,
                  letterSpacing: '0.06em',
                  fontSize: 13 * scale,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {opponent.shields.length === 0
                  ? 'ダイレクトアタック'
                  : 'シールドを攻撃'}
              </button>
            )}
          </div>
        </div>

        {/*
          操作ボタンと退出ボタンは、外枠ではなくこの中に置く。
          外枠にはノッチを避けるための余白が付いているため、
          ここに置かないとボタンがノッチの下に入って押せなくなる。
        */}

        {/* ===== 操作ボタン(右下) ===== */}
        <div
          style={{
            position: 'absolute',
            right: 40 * scale,
            bottom: 14 * scale,
            zIndex: 20,
          }}
        >
          <ActionButtons
            scale={scale}
            phase={state.phase}
            enabled={canOperate}
            canCancel={Boolean(selectedInstId || pendingAction)}
            onCancel={cancelAction}
            onToMain={() => requestAction({ type: 'toMainPhase' })}
            onToAttack={() => requestAction({ type: 'toAttackPhase' })}
            onEndTurn={() => requestAction({ type: 'endTurn' })}
          />
        </div>

      </div>

      {/* ===== ドラッグ中のカード ===== */}
      {dragInstId && dragPoint && (
        <div
          style={{
            position: 'fixed',
            left: dragPoint.x,
            top: dragPoint.y,
            transform: 'translate(-50%,-50%)',
            zIndex: 50,
            pointerEvents: 'none',
            opacity: 0.85,
          }}
        >
          <CardView
            card={getCard(
              [...me.hand, ...me.battleZone].find((c) => c.instId === dragInstId)
                ?.cardId ?? ''
            )}
            scale={scale}
          />
        </div>
      )}

      {/* ===== 割り込み: S・トリガー / G・ストライク ===== */}
      {state.pendingTrigger && state.pendingTrigger.owner === seat && (
        <Modal onClose={() => {}} maxWidth={440}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
            {state.pendingTrigger.special === 'gStrike'
              ? `G・ストライク「${getCard(state.pendingTrigger.inst.cardId)?.name}」を発動しますか？`
              : `S・トリガー「${getCard(state.pendingTrigger.inst.cardId)?.name}」をコスト無しで使いますか？`}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => onTriggerChoice(true)} style={primaryButton}>
              発動する
            </button>
            <button onClick={() => onTriggerChoice(false)} style={secondaryButton}>
              使わず手札に加える
            </button>
          </div>
        </Modal>
      )}

      {/* ===== 割り込み: ブロック ===== */}
      {state.pendingBlock && state.pendingBlock.defenderSeat === seat && (
        <Modal onClose={() => {}} maxWidth={560}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
            攻撃されています。ブロックしますか？
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {validBlockers(
              me,
              pool,
              getCard(
                state.players[state.pendingBlock.attackerSeat].battleZone.find(
                  (c) => c.instId === state.pendingBlock?.attackerInstId
                )?.cardId ?? ''
              )
            ).map((b) => (
              <button
                key={b.instId}
                onClick={() => onBlockChoice(b.instId)}
                style={primaryButton}
              >
                「{getCard(b.cardId)?.name}」でブロック
              </button>
            ))}
            <button onClick={() => onBlockChoice(null)} style={secondaryButton}>
              ブロックしない
            </button>
          </div>
        </Modal>
      )}

      {/* ===== 割り込み: 能力の対象選択 ===== */}
      {state.pendingAbilityChoice && state.pendingAbilityChoice.seat === seat && (
        <Modal onClose={() => {}} maxWidth={640}>
          <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>
            「{state.pendingAbilityChoice.sourceName}」の能力: 対象を1体選んでください
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectableTargets(state, seat).map(({ inst, ownerSeat }) => (
              <div
                key={inst.instId}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                <CardView card={getCard(inst.cardId)} instance={inst} scale={0.8} />
                <button
                  onClick={() => onAbilityTarget(inst.instId)}
                  style={{ ...primaryButton, fontSize: 11, padding: '6px 10px' }}
                >
                  {ownerSeat === seat ? '自分の' : '相手の'}これを選ぶ
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* 相手の応答待ち */}
      {interrupted &&
        !(state.pendingTrigger?.owner === seat) &&
        !(state.pendingBlock?.defenderSeat === seat) &&
        !(state.pendingAbilityChoice?.seat === seat) && (
          <Modal onClose={() => {}} maxWidth={360}>
            <p style={{ fontSize: 14, fontWeight: 700 }}>
              相手が選択しています…
            </p>
          </Modal>
        )}

      {/* ===== 確認 ===== */}
      {pendingAction && (
        <ConfirmModal
          message={describeAction(pendingAction, state, seat, pool)}
          danger={
            pendingAction.type === 'attack' && pendingAction.targetType === 'direct'
          }
          onConfirm={commitAction}
          onCancel={cancelAction}
        />
      )}

      {/* ===== 長押しの詳細 ===== */}
      {inspectCard && (
        <CardModal card={inspectCard} onClose={() => setInspectCard(null)} />
      )}
      {inspectZone && (
        <ZoneModal
          title={inspectZone.title}
          cards={inspectZone.cards}
          showCivSummary={inspectZone.showCivSummary}
          onClose={() => setInspectZone(null)}
          onSelectCard={setInspectCard}
        />
      )}
      {logOpen && <GameLog log={state.log} onClose={() => setLogOpen(false)} />}

      {/* ===== 決着 ===== */}
      {state.winner && (
        <Modal onClose={() => {}} maxWidth={400}>
          <p
            style={{
              fontSize: 24,
              fontWeight: 800,
              textAlign: 'center',
              letterSpacing: '0.2em',
              color: state.winner === seat ? ACCENT.gold : ACCENT.danger,
              textShadow:
                state.winner === seat
                  ? '0 0 24px rgba(255,197,61,0.6)'
                  : '0 0 24px rgba(255,77,109,0.5)',
            }}
          >
            {state.winner === seat ? 'VICTORY' : 'DEFEAT'}
          </p>
          <p
            style={{
              fontSize: 13,
              textAlign: 'center',
              color: INK.dim,
              marginTop: 8,
            }}
          >
            {state.players[state.winner].name} の勝ちです
          </p>
          <button onClick={onExit} style={{ ...primaryButton, width: '100%', marginTop: 16 }}>
            対戦を終える
          </button>
        </Modal>
      )}
    </div>
  );
}

/* ===== 補助 ===== */

const primaryButton: React.CSSProperties = {
  padding: '11px 18px',
  border: 'none',
  clipPath: clipDiagonal(9),
  background: `linear-gradient(180deg,${ACCENT.gold},#D89A12)`,
  color: '#1A1200',
  fontWeight: 800,
  letterSpacing: '0.06em',
  fontSize: 13,
  boxShadow: '0 0 14px rgba(255,197,61,0.4)',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: 'rgba(11,20,38,0.85)',
  boxShadow: `inset 0 0 0 1px ${NEON.faint}`,
  color: INK.dim,
};

/** 能力の対象に選べるクリーチャーを列挙する */
function selectableTargets(
  state: GameState,
  seat: Seat
): { inst: CardInstance; ownerSeat: Seat }[] {
  const pending = state.pendingAbilityChoice;
  if (!pending) return [];

  const oppSeat: Seat = seat === 'p1' ? 'p2' : 'p1';
  const own = state.players[seat].battleZone
    .filter((c) => c.kind === 'creature')
    .map((inst) => ({ inst, ownerSeat: seat }));
  const opp = state.players[oppSeat].battleZone
    .filter((c) => c.kind === 'creature' && !c.justDiverActive)
    .map((inst) => ({ inst, ownerSeat: oppSeat }));

  const target = pending.ability.target;
  if (target === 'chosenOwn') return own;
  if (target === 'chosenOpponent') return opp;
  return [...own, ...opp];
}

/** 確認画面に出す文言 */
function describeAction(
  action: PendingAction,
  state: GameState,
  seat: Seat,
  pool: Card[]
): string {
  const me = state.players[seat];
  const oppSeat: Seat = seat === 'p1' ? 'p2' : 'p1';
  const nameOf = (instId: string, list: CardInstance[]) => {
    const inst = list.find((c) => c.instId === instId);
    return inst ? lookupCard(pool, inst.cardId)?.name ?? 'カード' : 'カード';
  };

  switch (action.type) {
    case 'charge':
      return `「${nameOf(action.instId, me.hand)}」をマナゾーンに置きます。`;
    case 'summon':
      return `「${nameOf(action.instId, me.hand)}」を使います。`;
    case 'equip':
      return 'クロスギアを装備します。';
    case 'attack': {
      const attacker = nameOf(action.attackerInstId, me.battleZone);
      if (action.targetType === 'direct') {
        return `「${attacker}」でダイレクトアタックします。これで勝敗が決まります。`;
      }
      if (action.targetType === 'shield') {
        return `「${attacker}」で相手のシールドを攻撃します。`;
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
