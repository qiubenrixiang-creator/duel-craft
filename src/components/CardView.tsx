/**
 * カード1枚の描画。
 *
 * 対戦画面・カード作成のプレビュー・コレクションなど、
 * カードが出てくる場所はすべてこのコンポーネントを使う。
 *
 * 操作は usePress に任せ、タップ・長押し・ドラッグを判別する。
 *
 * 【デザイン: 電子カード】
 * 黒に近い紺の板に、文明色のネオンで縁と情報を焼き付けたような見た目にしている。
 *   ・左上と右下の角を斜めに切り落として「機械が切り出した板」に見せる
 *   ・イラストの四隅にブラケット(かぎ括弧)を置いて計器らしさを出す
 *   ・コストとパワーは等幅数字にして、桁が揺れないようにする
 * 縮小してもつぶれないよう、装飾は拡大率が一定以上のときだけ描く。
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
  NEON,
  VOID,
  clipDiagonal,
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
  /** 選択中(シアンに光る) */
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
  /** 細かい装飾は、小さく表示されている時は省く */
  const detailed = scale >= 0.55;

  if (!card) return null;

  const civs = card.civilizations ?? ['fire'];
  const primary = civs[0] ?? 'fire';
  const isMulti = civs.length > 1;
  const isMana = size === 'mana';
  const tapped = instance?.tapped ?? false;
  const cut = Math.max(4, 10 * scale);

  // 裏向き表示(相手の手札・山札)
  if (faceDown) {
    return (
      <div
        style={{
          width: dims.w,
          height: dims.h,
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          clipPath: clipDiagonal(cut),
          background: `linear-gradient(150deg,${VOID.raised},${VOID.base})`,
          boxShadow: `inset 0 0 0 1px ${NEON.faint}`,
        }}
      >
        {/* 回路模様。裏面だと分かる程度に薄く入れる。 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.5,
            background:
              `repeating-linear-gradient(90deg,transparent 0 ${7 * scale}px,${NEON.ghost} ${7 * scale}px ${7.6 * scale}px),` +
              `repeating-linear-gradient(0deg,transparent 0 ${7 * scale}px,${NEON.ghost} ${7 * scale}px ${7.6 * scale}px)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: dims.w * 0.42,
            height: dims.w * 0.42,
            transform: 'translate(-50%,-50%)',
            borderRadius: '50%',
            border: `1px solid ${NEON.dim}`,
            boxShadow: `0 0 ${8 * scale}px ${NEON.glow}`,
          }}
        />
      </div>
    );
  }

  const artImage = useSecretArt && card.secretImage ? card.secretImage : card.image;
  const rarityColor = card.rarity ? RARITY_COLOR[card.rarity] : null;
  const civEdge = CIV_COLOR[primary];

  return (
    <div
      {...press}
      style={{
        width: dims.w,
        height: dims.h,
        flexShrink: 0,
        position: 'relative',
        overflow: 'hidden',
        clipPath: clipDiagonal(cut),
        cursor: onTap || onDragStart ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        // 板そのものは暗く、情報だけが光って見えるようにする
        background: `linear-gradient(165deg,${VOID.raised} 0%,${VOID.deep} 55%,${VOID.base} 100%)`,
        color: INK.onCard,
        boxShadow: selected
          ? `inset 0 0 0 ${Math.max(1, 1.5 * scale)}px ${NEON.core}, 0 0 ${18 * scale}px ${NEON.glow}`
          : `inset 0 0 0 1px ${hexToRgba(civEdge, 0.5)}, 0 ${3 * scale}px ${10 * scale}px rgba(0,0,0,0.55)`,
        transform: [
          selected ? 'scale(1.05)' : '',
          tapped ? 'rotate(90deg) scale(0.9)' : '',
        ]
          .filter(Boolean)
          .join(' '),
        opacity: dragging ? 0.5 : dimmed ? 0.5 : 1,
        transition: `transform ${DURATION.select}ms ${EASING}, box-shadow ${DURATION.select}ms ${EASING}, opacity ${DURATION.tap}ms ${EASING}`,
        touchAction: 'none',
      }}
    >
      {/* 文明帯(左端)。多色は上下に分けて表示する。 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: Math.max(2, 3.5 * scale),
          zIndex: 3,
          background: isMulti
            ? `linear-gradient(180deg, ${CIV_COLOR[civs[0]]} 0 50%, ${CIV_COLOR[civs[1]]} 50% 100%)`
            : civEdge,
          boxShadow: `0 0 ${7 * scale}px ${hexToRgba(civEdge, 0.8)}`,
        }}
      />

      {/* 文明帯に重ねる目盛り。計器らしさを出すための飾り。 */}
      {detailed && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: '22%',
            bottom: '22%',
            width: Math.max(2, 3.5 * scale),
            zIndex: 4,
            background: `repeating-linear-gradient(180deg,rgba(0,0,0,0.55) 0 ${2 * scale}px,transparent ${2 * scale}px ${5 * scale}px)`,
          }}
        />
      )}

      {/* レアリティ(右上の角を落とした小札) */}
      {rarityColor && card.rarity !== 'N' && (
        <div
          className="hud-num"
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            zIndex: 5,
            padding: `${1.5 * scale}px ${5 * scale}px`,
            fontSize: f(8),
            fontWeight: 800,
            color: '#04070F',
            background: rarityColor,
            clipPath: 'polygon(6px 0,100% 0,100% 100%,0 100%)',
            boxShadow: `0 0 ${8 * scale}px ${hexToRgba(rarityColor, 0.7)}`,
          }}
        >
          {card.rarity}
        </div>
      )}

      {/* イラスト領域 */}
      <div
        style={{
          height: isMana ? '44%' : '50%',
          margin: `${7 * scale}px ${6 * scale}px 0 ${8 * scale}px`,
          position: 'relative',
          overflow: 'hidden',
          clipPath: clipDiagonal(Math.max(3, 6 * scale)),
          background: artImage ? VOID.base : CIV_ART_GRADIENT[primary],
          boxShadow: `inset 0 0 0 1px ${hexToRgba(civEdge, 0.35)}`,
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

        {/* イラストの上に薄い走査線を重ね、画面に映した映像のように見せる */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `repeating-linear-gradient(180deg,rgba(0,0,0,0) 0 ${1.5 * scale}px,rgba(0,0,0,0.28) ${1.5 * scale}px ${3 * scale}px)`,
            opacity: 0.55,
          }}
        />

        {/* 四隅のブラケット */}
        {detailed &&
          (
            [
              { top: 0, left: 0, borderWidth: '1px 0 0 1px' },
              { top: 0, right: 0, borderWidth: '1px 1px 0 0' },
              { bottom: 0, left: 0, borderWidth: '0 0 1px 1px' },
              { bottom: 0, right: 0, borderWidth: '0 1px 1px 0' },
            ] as const
          ).map((corner, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                ...corner,
                width: 6 * scale,
                height: 6 * scale,
                borderStyle: 'solid',
                borderColor: hexToRgba(civEdge, 0.85),
                pointerEvents: 'none',
              }}
            />
          ))}
      </div>

      {/* コスト(イラストの左上に重なる六角形の記章) */}
      <div
        className="hud-num"
        style={{
          position: 'absolute',
          left: 5 * scale,
          top: 4 * scale,
          zIndex: 6,
          width: (isMana ? 19 : 25) * scale,
          height: (isMana ? 19 : 25) * scale,
          clipPath: 'polygon(50% 0,93% 25%,93% 75%,50% 100%,7% 75%,7% 25%)',
          background: `linear-gradient(160deg,${hexToRgba(civEdge, 0.95)},${hexToRgba(civEdge, 0.6)})`,
          color: '#04070F',
          fontWeight: 800,
          fontSize: f(isMana ? 11 : 13),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {effectiveDisplayCost(card)}
      </div>

      {/* カード名 */}
      <div
        style={{
          margin: `${5 * scale}px ${6 * scale}px 0 ${9 * scale}px`,
          minWidth: 0,
        }}
      >
        {card.nameRuby && !isMana && detailed && (
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
            textShadow: `0 0 ${6 * scale}px rgba(125,249,255,0.25)`,
          }}
        >
          {card.name}
        </div>
      </div>

      {/* 種族。上に細い区切り線を引いて情報の階層を分ける。 */}
      {!isMana && card.race && (
        <div
          style={{
            margin: `${3 * scale}px ${6 * scale}px 0 ${9 * scale}px`,
            paddingTop: 2 * scale,
            borderTop: `1px solid ${hexToRgba(civEdge, 0.22)}`,
            fontSize: f(8),
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
            marginRight: 7 * scale,
            marginBottom: 5 * scale,
            marginLeft: 9 * scale,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'flex-end',
            gap: 4 * scale,
          }}
        >
          {/* パワーの左に伸びる目盛り線 */}
          {detailed && (
            <div
              style={{
                flex: 1,
                height: 4 * scale,
                marginBottom: 3 * scale,
                background: `repeating-linear-gradient(90deg,${hexToRgba(civEdge, 0.5)} 0 ${1.5 * scale}px,transparent ${1.5 * scale}px ${4 * scale}px)`,
              }}
            />
          )}
          <div
            className="hud-num"
            style={{
              fontSize: f(15),
              fontWeight: 800,
              lineHeight: 1,
              color: CIV_DEEP[primary],
              textShadow: `0 0 ${9 * scale}px ${hexToRgba(civEdge, 0.7)}`,
            }}
          >
            {displayPower(card, instance)}
          </div>
        </div>
      )}

      {/* キラ演出。斜めの光沢を一番上に重ねる。 */}
      {card.foil && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 7,
            pointerEvents: 'none',
            background:
              'linear-gradient(115deg,transparent 28%,rgba(125,249,255,0.30) 44%,rgba(184,99,255,0.22) 56%,transparent 72%)',
          }}
        />
      )}

      {/* タップ(横向き)状態を示す赤い細線 */}
      {tapped && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: Math.max(1, 2 * scale),
            zIndex: 8,
            background: '#FF4D6D',
            boxShadow: `0 0 ${8 * scale}px rgba(255,77,109,0.8)`,
          }}
        />
      )}
    </div>
  );
}

/** #RRGGBB を半透明にする。ネオンの発光量を場所ごとに変えるために使う。 */
function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
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
