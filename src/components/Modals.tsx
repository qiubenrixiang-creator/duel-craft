/**
 * 画面に重ねて表示する各種モーダル。
 *
 *   Modal        … 共通の枠
 *   CardModal    … 長押しで開くカード詳細(効果全文)
 *   ZoneModal    … 長押しで開くゾーンの中身一覧
 *   ConfirmModal … 操作の確認(選択→確認→実行の2段階目)
 */

import type { ReactNode } from 'react';
import type { Card, CardInstance, Civilization } from '../types/card';
import { CardView } from './CardView';
import {
  ACCENT,
  CIV_COLOR,
  CIV_LABEL,
  GLASS,
  INK,
} from '../ui/tokens';
import { RARITY_COLOR, RARITY_LABEL } from '../types/collection';
import { EFFECT_LABEL } from '../game/effects/effectRegistry';
import { EVENT_LABEL } from '../game/events/eventTypes';

/* ===== 共通の枠 ===== */

export interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  /** 最大幅(px) */
  maxWidth?: number;
}

export function Modal({ onClose, children, maxWidth = 520 }: ModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // ノッチやホームバーに重ならないようにする
        padding:
          'max(12px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right))' +
          ' max(12px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
        background: 'rgba(8,14,28,0.72)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth,
          maxHeight: '86svh',
          overflowY: 'auto',
          background: GLASS.panel,
          backdropFilter: GLASS.blur,
          border: `1px solid ${GLASS.edge}`,
          borderRadius: 16,
          padding: 20,
          color: INK.base,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ===== カード詳細 ===== */

export interface CardModalProps {
  card: Card;
  instance?: CardInstance;
  /** 所持枚数(コレクションから開いた場合) */
  ownedCount?: number;
  onClose: () => void;
}

export function CardModal({ card, instance, ownedCount, onClose }: CardModalProps) {
  const keywords = describeKeywords(card);

  return (
    <Modal onClose={onClose} maxWidth={620}>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <CardView card={card} instance={instance} size="large" scale={1} />

        <div style={{ flex: 1, minWidth: 220 }}>
          {card.nameRuby && (
            <div style={{ fontSize: 11, color: INK.dim }}>{card.nameRuby}</div>
          )}
          <h2 style={{ fontSize: 21, fontWeight: 700, lineHeight: 1.25 }}>
            {card.name}
          </h2>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
            <Chip>コスト {card.cost}</Chip>
            {card.civilizations.map((c) => (
              <Chip key={c} color={CIV_COLOR[c]}>
                {CIV_LABEL[c]}文明
              </Chip>
            ))}
            {card.race && <Chip>{card.race}</Chip>}
            {card.rarity && (
              <Chip color={RARITY_COLOR[card.rarity]}>
                {RARITY_LABEL[card.rarity]}
              </Chip>
            )}
            {ownedCount != null && <Chip>所持 {ownedCount}枚</Chip>}
          </div>

          {/* キーワード能力 */}
          {keywords.length > 0 && (
            <ul style={{ listStyle: 'none', margin: '8px 0', padding: 0 }}>
              {keywords.map((k) => (
                <li key={k} style={{ ...bulletStyle, color: ACCENT.gold }}>
                  {k}
                </li>
              ))}
            </ul>
          )}

          {/* 効果 */}
          {card.effects.length > 0 && (
            <ul style={{ listStyle: 'none', margin: '8px 0', padding: 0 }}>
              {card.effects.map((e, i) => (
                <li key={i} style={bulletStyle}>
                  【{EVENT_LABEL[e.trigger]}】{EFFECT_LABEL[e.effect]}
                  {e.value != null && e.value > 1 ? ` ×${e.value}` : ''}
                </li>
              ))}
            </ul>
          )}

          {/* ツインパクトの呪文面 */}
          {card.spellSide && (
            <div
              style={{
                marginTop: 12,
                paddingTop: 12,
                borderTop: `1px solid ${GLASS.edgeSoft}`,
              }}
            >
              <div style={{ fontSize: 11, color: CIV_COLOR.water, fontWeight: 700 }}>
                呪文面
              </div>
              <div style={{ fontWeight: 700 }}>{card.spellSide.name}</div>
              <div style={{ fontSize: 12, color: INK.dim }}>
                コスト {card.spellSide.cost}
              </div>
              <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0 }}>
                {card.spellSide.effects.map((e, i) => (
                  <li key={i} style={bulletStyle}>
                    【{EVENT_LABEL[e.trigger]}】{EFFECT_LABEL[e.effect]}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {card.flavor && (
            <p
              style={{
                marginTop: 12,
                fontSize: 12,
                fontStyle: 'italic',
                color: INK.dim,
              }}
            >
              {card.flavor}
            </p>
          )}
        </div>
      </div>

      <button onClick={onClose} style={closeButtonStyle}>
        閉じる
      </button>
    </Modal>
  );
}

/* ===== ゾーンの中身一覧 ===== */

export interface ZoneModalProps {
  title: string;
  cards: { card: Card | undefined; instance: CardInstance }[];
  /** マナゾーンの場合、文明ごとの枚数を出す */
  showCivSummary?: boolean;
  onClose: () => void;
  onSelectCard?: (card: Card) => void;
}

export function ZoneModal({
  title,
  cards,
  showCivSummary,
  onClose,
  onSelectCard,
}: ZoneModalProps) {
  // マナゾーンでは「どの文明が何枚あるか」が判断に直結するため集計して出す
  const civCounts = showCivSummary ? countCivilizations(cards) : null;

  return (
    <Modal onClose={onClose} maxWidth={720}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 700 }}>{title}</h2>
        <span style={{ fontSize: 13, color: INK.dim }}>{cards.length}枚</span>
      </div>

      {civCounts && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {Object.entries(civCounts).map(([civ, count]) => (
            <Chip key={civ} color={CIV_COLOR[civ as Civilization]}>
              {CIV_LABEL[civ as Civilization]} {count}
            </Chip>
          ))}
        </div>
      )}

      {cards.length === 0 ? (
        <p style={{ color: INK.dim, fontSize: 13 }}>カードがありません。</p>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {cards.map(({ card, instance }) => (
            <CardView
              key={instance.instId}
              card={card}
              instance={instance}
              scale={0.85}
              onTap={card && onSelectCard ? () => onSelectCard(card) : undefined}
            />
          ))}
        </div>
      )}

      <button onClick={onClose} style={closeButtonStyle}>
        閉じる
      </button>
    </Modal>
  );
}

/* ===== 確認ダイアログ ===== */

export interface ConfirmModalProps {
  message: string;
  /** 取り返しのつかない操作(ダイレクトアタックなど)は赤くする */
  danger?: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  message,
  danger,
  confirmLabel = '決定',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal onClose={onCancel} maxWidth={420}>
      <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.6, marginBottom: 16 }}>
        {message}
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onConfirm}
          style={{
            ...buttonBase,
            flex: 1,
            background: danger ? ACCENT.danger : ACCENT.gold,
            color: danger ? '#fff' : '#3A2A00',
          }}
        >
          {confirmLabel}
        </button>
        <button
          onClick={onCancel}
          style={{ ...buttonBase, background: 'rgba(90,104,128,0.6)', color: '#fff' }}
        >
          キャンセル
        </button>
      </div>
    </Modal>
  );
}

/* ===== 小さな部品 ===== */

function Chip({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: '4px 11px',
        borderRadius: 999,
        background: color ? `${color}33` : 'rgba(255,255,255,0.12)',
        border: `1px solid ${color ?? GLASS.edgeSoft}`,
        color: color ?? INK.base,
      }}
    >
      {children}
    </span>
  );
}

const bulletStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  paddingLeft: 14,
  position: 'relative',
};

const buttonBase: React.CSSProperties = {
  fontFamily: 'inherit',
  fontWeight: 700,
  fontSize: 14,
  padding: '12px 20px',
  borderRadius: 10,
  border: `1px solid ${GLASS.edge}`,
  cursor: 'pointer',
};

const closeButtonStyle: React.CSSProperties = {
  ...buttonBase,
  marginTop: 16,
  width: '100%',
  background: 'rgba(255,255,255,0.1)',
  color: INK.base,
};

/** キーワード能力を日本語の一覧にする */
function describeKeywords(card: Card): string[] {
  const k = card.keywords ?? {};
  const list: string[] = [];

  if (k.speedAttacker) list.push('スピードアタッカー');
  if (k.blocker) list.push('ブロッカー');
  if (k.shieldTrigger) list.push('S・トリガー');
  if (k.gStrike) list.push('G・ストライク');
  if (k.slayer) list.push('スレイヤー');
  if (k.cannotBeBlocked) list.push('ブロックされない');
  if (k.machFighter) list.push('マッハファイター');
  if (k.justDiver) list.push('ジャストダイバー');
  if (k.poweredBreaker) list.push('パワード・ブレイカー');
  if (k.escape) list.push('エスケープ');
  if (k.breakerType) {
    const label =
      k.breakerType === 'world' ? 'ワールド・ブレイカー' : `${k.breakerType}・ブレイカー`;
    list.push(label);
  }
  if (k.powerAttacker) list.push(`パワーアタッカー +${k.powerAttacker}`);
  if (k.costReduction) list.push(`コスト軽減 -${k.costReduction}`);
  if (k.revolutionChange) {
    list.push(`革命チェンジ: ${describeCondition(k.revolutionChange)}`);
  }
  if (k.invasion) list.push(`侵略: ${describeCondition(k.invasion)}`);
  if (k.evolutionFrom) list.push(`進化元: ${describeCondition(k.evolutionFrom)}`);

  return list;
}

function describeCondition(c: { race?: string; civilization?: Civilization }): string {
  const parts: string[] = [];
  if (c.civilization) parts.push(`${CIV_LABEL[c.civilization]}文明`);
  if (c.race) parts.push(c.race);
  return parts.length > 0 ? parts.join(' / ') : '指定なし';
}

/** 文明ごとの枚数を数える(多色は各文明に計上する) */
function countCivilizations(
  cards: { card: Card | undefined; instance: CardInstance }[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { card } of cards) {
    for (const civ of card?.civilizations ?? []) {
      counts[civ] = (counts[civ] ?? 0) + 1;
    }
  }
  return counts;
}
