/**
 * 対戦画面のゾーン表示。
 *
 * どのゾーンも「ラベル + 中身」という同じ形をとる。
 * 長押しで中身の一覧を開けるゾーン(バトルゾーン・マナ・墓地)と、
 * 非公開のため開けないゾーン(シールド・山札)がある。
 */

import type { ReactNode } from 'react';
import type { Card, CardInstance } from '../types/card';
import { CardView } from './CardView';
import { GLASS, INK, NEON, clipDiagonal } from '../ui/tokens';
import { usePress } from '../ui/usePress';

/* ===== ゾーンの共通の枠 ===== */

interface ZoneFrameProps {
  label: string;
  count?: number;
  scale: number;
  children: ReactNode;
  /** 長押しで一覧を開く */
  onLongPress?: () => void;
  /** ドロップ先として光らせる */
  highlighted?: boolean;
  /** 中身の縦幅を埋める */
  grow?: boolean;
}

function ZoneFrame({
  label,
  count,
  scale,
  children,
  onLongPress,
  highlighted,
  grow,
}: ZoneFrameProps) {
  const press = usePress({ onLongPress });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4 * scale,
        minWidth: 0,
        flex: grow ? 1 : undefined,
      }}
    >
      <div
        style={{
          fontSize: Math.max(8, 11 * scale),
          color: INK.dim,
          display: 'flex',
          alignItems: 'center',
          gap: 5 * scale,
          paddingLeft: 2,
          flexShrink: 0,
        }}
      >
        {/* ラベルの頭に置く光る目印 */}
        <span
          style={{
            width: Math.max(2, 3 * scale),
            height: Math.max(6, 9 * scale),
            background: NEON.core,
            boxShadow: `0 0 ${6 * scale}px ${NEON.glow}`,
            flexShrink: 0,
          }}
        />
        {label}
        {count != null && (
          <b
            className="hud-num"
            style={{
              color: NEON.bright,
              fontSize: Math.max(9, 13 * scale),
              textShadow: `0 0 ${7 * scale}px ${NEON.glow}`,
            }}
          >
            {count}
          </b>
        )}
      </div>

      <div
        {...press}
        className={`${press.className} hud-frame hud-brackets${
          highlighted ? ' is-active' : ''
        }`}
        style={{
          // 角の切り欠きの大きさ。拡大率に合わせて変える。
          clipPath: clipDiagonal(Math.max(5, 10 * scale)),
          padding: 8 * scale,
          display: 'flex',
          minHeight: 0,
          flex: grow ? 1 : undefined,
          backdropFilter: GLASS.blur,
          boxShadow: highlighted
            ? `inset 0 0 0 1px ${NEON.core}, 0 0 ${18 * scale}px ${NEON.glow}`
            : `inset 0 0 0 1px ${GLASS.edgeSoft}`,
          transition: 'box-shadow 120ms',
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ===== シールド ===== */

export interface ShieldZoneProps {
  count: number;
  label: string;
  scale: number;
}

/**
 * シールドは中身を見せない(非公開情報のため)。
 * 枚数だけが分かるよう、重ねた板として表示する。
 */
export function ShieldZone({ count, label, scale }: ShieldZoneProps) {
  return (
    <ZoneFrame label={label} count={count} scale={scale}>
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            style={{
              height: 34 * scale,
              // 左上と右下を切り落とした装甲板として描く
              clipPath: clipDiagonal(Math.max(3, 7 * scale)),
              background: `linear-gradient(135deg,${NEON.faint},rgba(7,16,31,0.85))`,
              boxShadow: `inset 0 0 0 1px ${NEON.dim}, 0 0 ${8 * scale}px rgba(34,211,238,0.18)`,
              marginTop: i === 0 ? 0 : -8 * scale,
            }}
          />
        ))}
        {count === 0 && (
          <div style={{ fontSize: 10 * scale, color: INK.dim }}>なし</div>
        )}
      </div>
    </ZoneFrame>
  );
}

/* ===== バトルゾーン ===== */

export interface BattleZoneProps {
  label: string;
  instances: CardInstance[];
  getCard: (cardId: string) => Card | undefined;
  scale: number;
  /** 選択中のカード */
  selectedInstId?: string | null;
  /** 攻撃可能なカードのid(光らせる) */
  actionableIds?: string[];
  /** 攻撃対象にできるカードのid */
  targetableIds?: string[];
  highlighted?: boolean;
  onCardTap?: (inst: CardInstance) => void;
  onCardLongPress?: (card: Card) => void;
  onCardDragStart?: (inst: CardInstance, p: { x: number; y: number }) => void;
  onCardDragMove?: (p: { x: number; y: number }) => void;
  onCardDragEnd?: (p: { x: number; y: number }) => void;
  onZoneLongPress?: () => void;
  draggingInstId?: string | null;
}

export function BattleZone({
  label,
  instances,
  getCard,
  scale,
  selectedInstId,
  actionableIds = [],
  targetableIds = [],
  highlighted,
  onCardTap,
  onCardLongPress,
  onCardDragStart,
  onCardDragMove,
  onCardDragEnd,
  onZoneLongPress,
  draggingInstId,
}: BattleZoneProps) {
  const creatures = instances.filter((c) => c.kind === 'creature');
  const gears = instances.filter((c) => c.kind === 'gear');

  return (
    <ZoneFrame
      label={label}
      count={instances.length}
      scale={scale}
      onLongPress={onZoneLongPress}
      highlighted={highlighted}
      grow
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          gap: 0,
          width: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        {[...creatures, ...gears].map((inst, i) => {
          const card = getCard(inst.cardId);
          const canAct = actionableIds.includes(inst.instId);
          const isTarget = targetableIds.includes(inst.instId);

          return (
            <div
              key={inst.instId}
              style={{
                // カード同士を少し重ねて、横幅を節約する
                marginLeft: i === 0 ? 0 : -18 * scale,
                position: 'relative',
              }}
            >
              <CardView
                card={card}
                instance={inst}
                scale={scale}
                selected={selectedInstId === inst.instId || isTarget}
                dimmed={!canAct && !isTarget && actionableIds.length > 0}
                dragging={draggingInstId === inst.instId}
                onTap={onCardTap ? () => onCardTap(inst) : undefined}
                onLongPress={
                  card && onCardLongPress ? () => onCardLongPress(card) : undefined
                }
                onDragStart={
                  onCardDragStart && canAct
                    ? (p) => onCardDragStart(inst, p)
                    : undefined
                }
                onDragMove={onCardDragMove}
                onDragEnd={onCardDragEnd}
              />
              {/* 攻撃できるカードに印を付ける */}
              {canAct && (
                <div
                  style={{
                    position: 'absolute',
                    top: -4 * scale,
                    right: -2 * scale,
                    width: 8 * scale,
                    height: 8 * scale,
                    borderRadius: '50%',
                    background: '#3FD08A',
                    boxShadow: '0 0 6px rgba(63,208,138,0.9)',
                  }}
                />
              )}
            </div>
          );
        })}
        {instances.length === 0 && (
          <div style={{ fontSize: 11 * scale, color: INK.dim }}>クリーチャーなし</div>
        )}
      </div>
    </ZoneFrame>
  );
}

/* ===== マナゾーン ===== */

export interface ManaZoneProps {
  label: string;
  instances: CardInstance[];
  getCard: (cardId: string) => Card | undefined;
  scale: number;
  highlighted?: boolean;
  onZoneLongPress?: () => void;
  onCardLongPress?: (card: Card) => void;
}

export function ManaZone({
  label,
  instances,
  getCard,
  scale,
  highlighted,
  onZoneLongPress,
  onCardLongPress,
}: ManaZoneProps) {
  const untapped = instances.filter((m) => !m.tapped).length;

  return (
    <ZoneFrame
      label={`${label}(使える ${untapped})`}
      count={instances.length}
      scale={scale}
      onLongPress={onZoneLongPress}
      highlighted={highlighted}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4 * scale,
          alignContent: 'flex-start',
          width: '100%',
          overflowY: 'auto',
        }}
      >
        {instances.map((inst) => {
          const card = getCard(inst.cardId);
          return (
            <CardView
              key={inst.instId}
              card={card}
              instance={inst}
              size="mana"
              scale={scale}
              onLongPress={
                card && onCardLongPress ? () => onCardLongPress(card) : undefined
              }
            />
          );
        })}
        {instances.length === 0 && (
          <div style={{ fontSize: 11 * scale, color: INK.dim }}>マナなし</div>
        )}
      </div>
    </ZoneFrame>
  );
}

/* ===== 手札 ===== */

export interface HandZoneProps {
  instances: CardInstance[];
  getCard: (cardId: string) => Card | undefined;
  scale: number;
  /** 出せるカードのid */
  playableIds?: string[];
  selectedInstId?: string | null;
  draggingInstId?: string | null;
  onCardTap?: (inst: CardInstance) => void;
  onCardLongPress?: (card: Card) => void;
  onCardDragStart?: (inst: CardInstance, p: { x: number; y: number }) => void;
  onCardDragMove?: (p: { x: number; y: number }) => void;
  onCardDragEnd?: (p: { x: number; y: number }) => void;
}

export function HandZone({
  instances,
  getCard,
  scale,
  playableIds = [],
  selectedInstId,
  draggingInstId,
  onCardTap,
  onCardLongPress,
  onCardDragStart,
  onCardDragMove,
  onCardDragEnd,
}: HandZoneProps) {
  return (
    <ZoneFrame label="手札" count={instances.length} scale={scale}>
      <div
        style={{
          display: 'flex',
          gap: 8 * scale,
          width: '100%',
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: 4 * scale,
          alignItems: 'flex-end',
        }}
      >
        {instances.map((inst) => {
          const card = getCard(inst.cardId);
          const playable = playableIds.includes(inst.instId);

          return (
            <div
              key={inst.instId}
              style={{
                transition: 'transform 180ms cubic-bezier(0.22,1,0.36,1)',
                transform: selectedInstId === inst.instId ? `translateY(${-10 * scale}px)` : undefined,
              }}
            >
              <CardView
                card={card}
                instance={inst}
                scale={scale}
                selected={selectedInstId === inst.instId}
                dimmed={!playable && playableIds.length > 0}
                dragging={draggingInstId === inst.instId}
                onTap={onCardTap ? () => onCardTap(inst) : undefined}
                onLongPress={
                  card && onCardLongPress ? () => onCardLongPress(card) : undefined
                }
                onDragStart={
                  onCardDragStart ? (p) => onCardDragStart(inst, p) : undefined
                }
                onDragMove={onCardDragMove}
                onDragEnd={onCardDragEnd}
              />
            </div>
          );
        })}
        {instances.length === 0 && (
          <div style={{ fontSize: 11 * scale, color: INK.dim }}>手札なし</div>
        )}
      </div>
    </ZoneFrame>
  );
}

/* ===== 山札・墓地 ===== */

export interface DeckCounterProps {
  deckCount: number;
  graveyardCount: number;
  /** 相手の手札枚数(相手側のみ表示) */
  handCount?: number;
  scale: number;
  onGraveyardLongPress?: () => void;
}

export function DeckCounter({
  deckCount,
  graveyardCount,
  handCount,
  scale,
  onGraveyardLongPress,
}: DeckCounterProps) {
  const gravePress = usePress({ onLongPress: onGraveyardLongPress });

  const box = (value: number, label: string, extra?: object) => (
    <div
      className="hud-brackets"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${8 * scale}px 0`,
        position: 'relative',
        clipPath: clipDiagonal(Math.max(4, 8 * scale)),
        background: GLASS.panelSoft,
        boxShadow: `inset 0 0 0 1px ${GLASS.edgeSoft}`,
        ...extra,
      }}
    >
      <b
        className="hud-num"
        style={{
          fontSize: 20 * scale,
          lineHeight: 1,
          color: INK.base,
          textShadow: `0 0 ${8 * scale}px ${NEON.glow}`,
        }}
      >
        {value}
      </b>
      <span style={{ fontSize: 10 * scale, color: INK.dim, marginTop: 2 }}>
        {label}
      </span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 * scale }}>
      {handCount != null && (
        <div style={{ display: 'flex', gap: 6 * scale }}>
          {box(handCount, '相手の手札')}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 * scale }}>
        {box(deckCount, '山札')}
        <div {...gravePress} style={{ flex: 1, display: 'flex' }}>
          {box(graveyardCount, '墓地', { cursor: 'pointer' })}
        </div>
      </div>
    </div>
  );
}
