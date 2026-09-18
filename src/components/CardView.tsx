/**
 * カード1枚の描画。
 *
 * 対戦画面・カード作成のプレビュー・コレクションなど、
 * カードが出てくる場所はすべてこのコンポーネントを使う。
 *
 * 操作は usePress に任せ、タップ・長押し・ドラッグを判別する。
 */

import { useMemo } from 'react';
import type { Card, CardInstance } from '../types/card';
import {
  CARD_SIZE,
  CIV_ART_GRADIENT,
  CIV_COLOR,
  CIV_DEEP,
  DURATION,
  EASING,
  INK,
} from '../ui/tokens';
import { RARITY_COLOR } from '../types/collection';
import { usePress } from '../ui/usePress';

export type CardViewSize = 'normal' | 'mana' | 'large';

export interface CardViewProps {
  card: Card | undefined;
  /** 場に出ている場合の実体。タップ状態などの表示に使う。 */
  instance?: CardInstance;
  size?: CardViewSize;
  /** 全体の拡大率 */
  scale?: number;
  /** 選択中(青く光る) */
  selected?: boolean;
  /** 操作できない状態(暗く表示) */
  dimmed?: boolean;
  /** ドラッグ中(半透明) */
  dragging?: boolean;
  /** 裏向き(相手の手札など) */
  faceDown?: boolean;
  /** シークレット版のイラストで表示する */
  useSecretArt?: boolean;
  onTap?: () => void;
  onLongPress?: () => void;
  onDragStart?: (p: { x: number; y: number }) => void;
  onDragMove?: (p: { x: number; y: number }) => void;
  onDragEnd?: (p: { x: number; y: number }) => void;
  disabled?: boolean;
}

export function CardView({
  card,
  instance,
  size = 'normal',
  scale = 1,
  selected = false,
  dimmed = false,
  dragging = false,
  faceDown = false,
  useSecretArt = false,
  onTap,
  onLongPress,
  onDragStart,
  onDragMove,
  onDragEnd,
  disabled = false,
}: CardViewProps) {
  const press = usePress({
    onTap,
    onLongPress,
    onDragStart,
    onDragMove,
    onDragEnd,
    disabled,
  });

  const dims = useMemo(() => {
    if (size === 'mana') {
      return { w: CARD_SIZE.manaWidth * scale, h: CARD_SIZE.manaHeight * scale };
    }
    if (size === 'large') {
      return { w: CARD_SIZE.width * scale * 1.6, h: CARD_SIZE.height * scale * 1.6 };
    }
    return { w: CARD_SIZE.width * scale, h: CARD_SIZE.height * scale };
  }, [size, scale]);

  // 拡大率に応じて文字も小さくする
  const f = (base: number) => Math.max(5, base * scale);

  if (!card) return null;

  const civs = card.civilizations ?? ['fire'];
  const primary = civs[0] ?? 'fire';
  const isMulti = civs.length > 1;
  const isMana = size === 'mana';
  const tapped = instance?.tapped ?? false;

  // 裏向き表示(相手の手札・山札)
  if (faceDown) {
    return (
      <div
        style={{
          width: dims.w,
          height: dims.h,
          borderRadius: 9 * scale,
          background: 'linear-gradient(150deg,#3A5590,#22345C)',
          border: `1px solid rgba(255,255,255,0.3)`,
          flexShrink: 0,
        }}
      />
    );
  }

  const artImage = useSecretArt && card.secretImage ? card.secretImage : card.image;
  const rarityColor = card.rarity ? RARITY_COLOR[card.rarity] : null;

  return (
    <div
      {...press}
      style={{
        width: dims.w,
        height: dims.h,
        flexShrink: 0,
        position: 'relative',
        borderRadius: 9 * scale,
        overflow: 'hidden',
        cursor: onTap || onDragStart ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        background:
          'linear-gradient(180deg,rgba(255,255,255,0.94),rgba(232,240,250,0.92))',
        border: `1px solid rgba(255,255,255,0.6)`,
        color: INK.onCard,
        // 選択中は青く光らせ、少し大きくする
        boxShadow: selected
          ? `0 0 0 ${3 * scale}px ${CIV_COLOR.water}, 0 0 ${20 * scale}px rgba(79,184,245,0.75)`
          : `0 ${4 * scale}px ${14 * scale}px rgba(0,0,0,0.28)`,
        transform: [
          selected ? 'scale(1.05)' : '',
          tapped ? 'rotate(90deg) scale(0.9)' : '',
        ]
          .filter(Boolean)
          .join(' '),
        opacity: dragging ? 0.5 : dimmed ? 0.55 : 1,
        transition: `transform ${DURATION.select}ms ${EASING}, box-shadow ${DURATION.select}ms ${EASING}, opacity ${DURATION.tap}ms ${EASING}`,
        touchAction: 'none',
      }}
    >
      {/* 文明帯(左端)。多色は分割して表示する。 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4 * scale,
          background: isMulti
            ? `linear-gradient(180deg, ${CIV_COLOR[civs[0]]} 0 50%, ${CIV_COLOR[civs[1]]} 50% 100%)`
            : CIV_COLOR[primary],
          zIndex: 2,
        }}
      />

      {/* レアリティ表示(右上の小さな帯) */}
      {rarityColor && card.rarity !== 'N' && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            zIndex: 3,
            padding: `${1.5 * scale}px ${5 * scale}px`,
            fontSize: f(8),
            fontWeight: 800,
            color: '#16233B',
            background: rarityColor,
            borderBottomLeftRadius: 5 * scale,
          }}
        >
          {card.rarity}
        </div>
      )}

      {/* キラ演出 */}
      {card.foil && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 4,
            pointerEvents: 'none',
            background:
              'linear-gradient(115deg,transparent 30%,rgba(255,255,255,0.45) 45%,rgba(180,123,245,0.25) 55%,transparent 70%)',
          }}
        />
      )}

      {/* コスト */}
      <div
        style={{
          position: 'absolute',
          left: 8 * scale,
          top: 7 * scale,
          zIndex: 3,
          width: (isMana ? 20 : 26) * scale,
          height: (isMana ? 20 : 26) * scale,
          borderRadius: '50%',
          background: '#16233B',
          color: '#fff',
          fontWeight: 800,
          fontSize: f(isMana ? 11 : 14),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 ${2 * scale}px ${6 * scale}px rgba(0,0,0,0.3)`,
        }}
      >
        {effectiveDisplayCost(card)}
      </div>

      {/* イラスト領域。画像が無ければ文明色のグラデーションを出す。 */}
      <div
        style={{
          height: isMana ? '44%' : '52%',
          margin: `${6 * scale}px ${6 * scale}px 0 ${9 * scale}px`,
          borderRadius: 6 * scale,
          position: 'relative',
          overflow: 'hidden',
          background: artImage ? undefined : CIV_ART_GRADIENT[primary],
        }}
      >
        {artImage && (
          <img
            src={artImage}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            draggable={false}
          />
        )}
        {!artImage && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(60% 50% at 30% 25%,rgba(255,255,255,0.7),transparent 60%)',
            }}
          />
        )}
      </div>

      {/* カード名 */}
      <div
        style={{
          margin: `${5 * scale}px ${7 * scale}px 0 ${10 * scale}px`,
          minWidth: 0,
        }}
      >
        {card.nameRuby && !isMana && (
          <div
            style={{
              fontSize: f(6.5),
              color: INK.onCardDim,
              lineHeight: 1.1,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {card.nameRuby}
          </div>
        )}
        <div
          style={{
            fontSize: f(isMana ? 8 : 10.5),
            fontWeight: 700,
            lineHeight: 1.2,
            display: '-webkit-box',
            WebkitLineClamp: isMana ? 1 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {card.name}
        </div>
      </div>

      {/* 種族 */}
      {!isMana && card.race && (
        <div
          style={{
            margin: `${2 * scale}px ${7 * scale}px 0 ${10 * scale}px`,
            fontSize: f(8.5),
            color: INK.onCardDim,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {card.race}
        </div>
      )}

      {/* パワー */}
      {!isMana && card.power != null && (
        <div
          style={{
            marginTop: 'auto',
            marginRight: 8 * scale,
            marginBottom: 6 * scale,
            textAlign: 'right',
            fontSize: f(15),
            fontWeight: 800,
            color: CIV_DEEP[primary],
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {displayPower(card, instance)}
        </div>
      )}
    </div>
  );
}

/** コスト軽減を反映した表示用コスト */
function effectiveDisplayCost(card: Card): number {
  const reduction = card.keywords?.costReduction ?? 0;
  return Math.max(0, card.cost - reduction);
}

/** 効果によるパワー増減を反映した表示 */
function displayPower(card: Card, instance?: CardInstance): number {
  return (card.power ?? 0) + (instance?.powerMod ?? 0);
}
