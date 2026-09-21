/**
 * 背景の描画。
 *
 * 【デザイン: サイバー空間】
 * 4層を重ねる。
 *   1. 下地       … 暗いグラデーション
 *   2. グリッド   … 奥行きを出す格子。上下を薄くして地平線のように見せる。
 *   3. モチーフ   … 中央に浮かぶHUD図形(SVGで描画)
 *   4. 周辺減光   … 四隅を暗く落として中央のカードに目を向けさせる
 *
 * すべてCSSとSVGで描いており、画像素材は使っていない。
 * 視認性を最優先するため、どの層も不透明度をかなり低く抑えている。
 */

import { useMemo } from 'react';
import type { FieldId } from '../types/ui';
import { getField } from '../ui/fields';
import type { FieldDefinition } from '../ui/fields';
import { VOID } from '../ui/tokens';

export interface BackgroundFieldProps {
  fieldId: FieldId;
  /** 背景なし(単色)にする */
  disabled?: boolean;
}

export function BackgroundField({ fieldId, disabled }: BackgroundFieldProps) {
  const field = getField(fieldId);

  if (disabled) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 0, background: VOID.deep }}
      />
    );
  }

  const grid = rgba(field.accent, 0.1 * field.gridStrength + 0.04);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, overflow: 'hidden' }}>
      {/* 1. 下地 */}
      <div style={{ position: 'absolute', inset: 0, background: field.base }} />

      {/* 2. グリッド。上下端をぼかして、無限に続く床のように見せる。 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            `repeating-linear-gradient(90deg,transparent 0 ${field.gridSize - 1}px,${grid} ${field.gridSize - 1}px ${field.gridSize}px),` +
            `repeating-linear-gradient(0deg,transparent 0 ${field.gridSize - 1}px,${grid} ${field.gridSize - 1}px ${field.gridSize}px)`,
          maskImage:
            'linear-gradient(180deg,transparent 0%,#000 22%,#000 78%,transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(180deg,transparent 0%,#000 22%,#000 78%,transparent 100%)',
        }}
      />

      {/* 3. 中央のHUD図形 */}
      <Motif field={field} />

      {/* 4. 周辺減光 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(120% 80% at 50% 50%,transparent 35%,rgba(2,4,10,0.55) 80%,rgba(2,4,10,0.85) 100%)',
        }}
      />
    </div>
  );
}

/**
 * 中央に浮かぶHUD図形。
 * どれも線画で、不透明度を抑えてカードの邪魔をしないようにしている。
 */
function Motif({ field }: { field: FieldDefinition }) {
  const line = rgba(field.accent, 0.5);
  const lineSoft = rgba(field.accent, 0.22);
  const fill = rgba(field.accent, 0.08);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.55,
      }}
    >
      <svg
        viewBox="0 0 400 400"
        // 画面の短い辺に合わせ、はみ出すくらい大きく置く
        style={{ width: '78vh', height: '78vh', maxWidth: '110vw', overflow: 'visible' }}
        fill="none"
        aria-hidden="true"
      >
        {field.motif === 'rings' && (
          <>
            <circle cx="200" cy="200" r="190" stroke={lineSoft} strokeWidth="1" />
            <circle cx="200" cy="200" r="150" stroke={line} strokeWidth="2" />
            <circle cx="200" cy="200" r="112" stroke={lineSoft} strokeWidth="1" />
            <circle cx="200" cy="200" r="74" stroke={lineSoft} strokeWidth="1" />
            {/* 途切れた弧を重ねて、回っている計器のように見せる */}
            <path d="M200 26 A174 174 0 0 1 356 130" stroke={line} strokeWidth="5" />
            <path d="M200 374 A174 174 0 0 1 44 270" stroke={line} strokeWidth="5" />
            <g style={spin(90)}>
              <path
                d="M200 62 A138 138 0 0 1 320 140"
                stroke={rgba(field.accent, 0.75)}
                strokeWidth="3"
              />
            </g>
            <TickRing color={lineSoft} radius={190} count={48} />
          </>
        )}

        {field.motif === 'radar' && (
          <>
            <circle cx="200" cy="200" r="185" stroke={lineSoft} strokeWidth="1" />
            <circle cx="200" cy="200" r="124" stroke={lineSoft} strokeWidth="1" />
            <circle cx="200" cy="200" r="62" stroke={lineSoft} strokeWidth="1" />
            <line x1="15" y1="200" x2="385" y2="200" stroke={lineSoft} strokeWidth="1" />
            <line x1="200" y1="15" x2="200" y2="385" stroke={lineSoft} strokeWidth="1" />
            {/* 走査する扇形 */}
            <g style={spin(8)}>
              <path d="M200 200 L385 200 A185 185 0 0 0 330 70 Z" fill={fill} />
              <line x1="200" y1="200" x2="385" y2="200" stroke={line} strokeWidth="2" />
            </g>
            <TickRing color={lineSoft} radius={185} count={36} />
          </>
        )}

        {field.motif === 'orbit' && (
          <>
            <circle cx="200" cy="200" r="46" stroke={line} strokeWidth="2" fill={fill} />
            {[0, 60, 120].map((deg) => (
              <ellipse
                key={deg}
                cx="200"
                cy="200"
                rx="185"
                ry="66"
                stroke={deg === 0 ? line : lineSoft}
                strokeWidth={deg === 0 ? 2 : 1}
                transform={`rotate(${deg} 200 200)`}
              />
            ))}
            <g style={spin(40)}>
              <circle cx="385" cy="200" r="7" fill={rgba(field.accent, 0.8)} />
            </g>
            <g style={spin(64, true)}>
              <circle cx="200" cy="30" r="5" fill={rgba(field.accent, 0.6)} />
            </g>
          </>
        )}

        {field.motif === 'hex' && (
          <>
            {/* 六角形を入れ子にして、細胞のような広がりを出す */}
            {[190, 150, 110, 70].map((r, i) => (
              <polygon
                key={r}
                points={hexPoints(200, 200, r)}
                stroke={i === 1 ? line : lineSoft}
                strokeWidth={i === 1 ? 2 : 1}
                fill={i === 3 ? fill : 'none'}
              />
            ))}
            {[0, 60, 120, 180, 240, 300].map((deg) => (
              <line
                key={deg}
                x1="200"
                y1="200"
                x2="200"
                y2="10"
                stroke={lineSoft}
                strokeWidth="1"
                transform={`rotate(${deg} 200 200)`}
              />
            ))}
          </>
        )}

        {field.motif === 'wave' && (
          <>
            {[0, 1, 2, 3, 4].map((i) => (
              <path
                key={i}
                d={wavePath(200 + (i - 2) * 52, 14 + i * 4)}
                stroke={i === 2 ? line : lineSoft}
                strokeWidth={i === 2 ? 2 : 1}
              />
            ))}
            <line x1="0" y1="200" x2="400" y2="200" stroke={lineSoft} strokeWidth="1" />
            <TickRing color={lineSoft} radius={170} count={24} />
          </>
        )}

        {field.motif === 'circuit' && (
          <>
            {/* 基板の配線。直角に折れる線と、その先の接点。 */}
            <path
              d="M20 120 H120 L150 90 H260 L290 120 H380"
              stroke={line}
              strokeWidth="2"
            />
            <path
              d="M20 200 H90 L120 230 H200 L230 200 H380"
              stroke={lineSoft}
              strokeWidth="1"
            />
            <path
              d="M20 300 H140 L170 270 H250 L280 300 H380"
              stroke={line}
              strokeWidth="2"
            />
            <path d="M200 90 V30" stroke={lineSoft} strokeWidth="1" />
            <path d="M200 300 V370" stroke={lineSoft} strokeWidth="1" />
            <rect
              x="150"
              y="160"
              width="100"
              height="80"
              stroke={line}
              strokeWidth="2"
              fill={fill}
            />
            {[
              [120, 90],
              [290, 120],
              [230, 200],
              [170, 270],
              [280, 300],
              [200, 30],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill={rgba(field.accent, 0.7)} />
            ))}
          </>
        )}

        {field.motif === 'glitch' && (
          <>
            {/* 明滅する矩形群。位置は固定で、大きさだけ散らす。 */}
            {GLITCH_BLOCKS.map((b, i) => (
              <rect
                key={i}
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                fill={rgba(field.accent, b.a)}
              />
            ))}
            {[80, 200, 320].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="400"
                y2={y}
                stroke={lineSoft}
                strokeWidth="1"
              />
            ))}
          </>
        )}

        {field.motif === 'shards' && (
          <>
            {/* 切り立った多角形を重ねて、稜線のように見せる */}
            <polygon
              points="0,330 90,170 160,250 240,120 320,240 400,150 400,400 0,400"
              fill={fill}
              stroke={lineSoft}
              strokeWidth="1"
            />
            <polygon
              points="0,370 110,230 190,300 270,190 350,290 400,230 400,400 0,400"
              fill={rgba(field.accent, 0.06)}
              stroke={line}
              strokeWidth="2"
            />
            <line x1="0" y1="120" x2="400" y2="120" stroke={lineSoft} strokeWidth="1" />
            <circle cx="200" cy="70" r="34" stroke={line} strokeWidth="2" />
            <circle cx="200" cy="70" r="14" fill={rgba(field.accent, 0.35)} />
          </>
        )}
      </svg>
    </div>
  );
}

/** 円周上に並ぶ目盛り。計器らしさを足すための飾り。 */
function TickRing({
  color,
  radius,
  count,
}: {
  color: string;
  radius: number;
  count: number;
}) {
  const ticks = Array.from({ length: count }, (_, i) => (i * 360) / count);
  return (
    <g>
      {ticks.map((deg) => (
        <line
          key={deg}
          x1="200"
          y1={200 - radius}
          x2="200"
          y2={200 - radius + 9}
          stroke={color}
          strokeWidth="1"
          transform={`rotate(${deg} 200 200)`}
        />
      ))}
    </g>
  );
}

/** ゆっくり回転させる指定。秒数が大きいほど遅い。 */
function spin(seconds: number, reverse = false): React.CSSProperties {
  return {
    transformOrigin: '200px 200px',
    animation: `${reverse ? 'hud-spin-reverse' : 'hud-spin'} ${seconds}s linear infinite`,
  };
}

/** 中心(cx,cy)・半径rの正六角形 */
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i - 90);
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
  }).join(' ');
}

/** 画面を横断する波形。yを中心に振幅ampで揺れる。 */
function wavePath(y: number, amp: number): string {
  const points: string[] = [];
  for (let x = 0; x <= 400; x += 20) {
    const dy = Math.sin((x / 400) * Math.PI * 4) * amp;
    points.push(`${x === 0 ? 'M' : 'L'}${x} ${(y + dy).toFixed(1)}`);
  }
  return points.join(' ');
}

/** glitch モチーフの矩形。毎回変わると目が疲れるので固定値にしている。 */
const GLITCH_BLOCKS = [
  { x: 24, y: 60, w: 70, h: 18, a: 0.22 },
  { x: 118, y: 44, w: 38, h: 38, a: 0.14 },
  { x: 250, y: 74, w: 96, h: 22, a: 0.2 },
  { x: 46, y: 148, w: 44, h: 44, a: 0.16 },
  { x: 150, y: 132, w: 120, h: 56, a: 0.26 },
  { x: 300, y: 170, w: 58, h: 30, a: 0.15 },
  { x: 70, y: 244, w: 90, h: 26, a: 0.2 },
  { x: 196, y: 232, w: 34, h: 34, a: 0.13 },
  { x: 268, y: 258, w: 78, h: 44, a: 0.18 },
  { x: 110, y: 320, w: 56, h: 20, a: 0.15 },
  { x: 224, y: 334, w: 104, h: 24, a: 0.21 },
];

export interface WeatherEffectProps {
  fieldId: FieldId;
  disabled?: boolean;
}

/**
 * 空間に漂うもの。
 * 粒子が上下に流れ、その上を走査ビームがゆっくり降りていく。
 */
export function WeatherEffect({ fieldId, disabled }: WeatherEffectProps) {
  const field = getField(fieldId);

  // 描画位置をランダムに決めるが、再描画のたびに変わらないよう記憶する
  const particles = useMemo(() => {
    if (disabled || field.particle === 'none') return [];
    const count = field.particle === 'data' ? 18 : 14;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: field.particle === 'data' ? 3 + Math.random() * 14 : 3,
      delay: -Math.random() * 40,
      duration: 11 + Math.random() * 12,
    }));
  }, [fieldId, disabled, field.particle]);

  if (disabled) return null;

  const tint = rgba(field.accent, 0.55);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <style>{`
        @keyframes dc-rise { from { transform: translateY(0) }     to { transform: translateY(-100vh) } }
        @keyframes dc-fall { from { transform: translateY(-10vh) } to { transform: translateY(110vh) } }
        @media (prefers-reduced-motion: reduce) {
          .dc-particle, .dc-beam { animation: none !important; }
        }
      `}</style>

      {/* 走査ビーム。画面をゆっくり降りていく細い帯。 */}
      <div
        className="dc-beam"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: '26vh',
          background: `linear-gradient(180deg,transparent,${rgba(field.accent, 0.07)},transparent)`,
          animation: 'hud-sweep 9s linear infinite',
        }}
      />

      {particles.map((p) => {
        // data は下向きに流れる短冊、それ以外は上へ昇る粒
        const isData = field.particle === 'data';
        return (
          <div
            key={p.id}
            className="dc-particle"
            style={{
              position: 'absolute',
              left: `${p.left}vw`,
              top: `${p.top}vh`,
              width: isData ? 2 : p.size,
              height: isData ? p.size * 3 : p.size,
              borderRadius: isData ? 0 : 999,
              background: tint,
              // 視認性を損なわないよう、かなり薄くする
              opacity: 0.16,
              boxShadow: `0 0 6px ${tint}`,
              animation: `${isData ? 'dc-fall' : 'dc-rise'} ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}

/** #RRGGBB を半透明にする */
function rgba(hex: string, alpha: number): string {
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
