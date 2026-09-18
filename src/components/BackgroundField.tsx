/**
 * 背景の描画。
 *
 * 3層(空・遠景・近景)を重ね、その上に薄い天候演出を載せる。
 * すべてCSSで描いており、画像素材は使っていない。
 *
 * 視認性を最優先するため、天候の透明度は10%以下に抑えている。
 */

import { useMemo } from 'react';
import type { FieldId } from '../types/ui';
import { getField } from '../ui/fields';

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
        style={{ position: 'fixed', inset: 0, zIndex: 0, background: '#16233B' }}
      />
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
      <div style={{ position: 'absolute', inset: 0, background: field.sky }} />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: field.farHeight,
          background: field.far,
          opacity: 0.9,
        }}
      />
      {field.near && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: field.nearHeight,
            background: field.near,
          }}
        />
      )}
    </div>
  );
}

export interface WeatherEffectProps {
  fieldId: FieldId;
  disabled?: boolean;
}

/**
 * 天候演出。
 * 背景の種類に応じて、雲・光の粒・雪・落ち葉を薄く流す。
 */
export function WeatherEffect({ fieldId, disabled }: WeatherEffectProps) {
  const field = getField(fieldId);

  // 描画位置をランダムに決めるが、再描画のたびに変わらないよう記憶する
  const particles = useMemo(() => {
    if (disabled || field.weather === 'none') return [];
    const count = field.weather === 'clouds' ? 5 : 14;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: field.weather === 'clouds' ? 120 + Math.random() * 220 : 4,
      delay: -Math.random() * 40,
      duration:
        field.weather === 'clouds' ? 38 + Math.random() * 22 : 10 + Math.random() * 8,
    }));
  }, [fieldId, disabled, field.weather]);

  if (particles.length === 0) return null;

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
        @keyframes dc-drift { from { transform: translateX(-30vw) } to { transform: translateX(130vw) } }
        @keyframes dc-rise  { from { transform: translateY(0) }      to { transform: translateY(-100vh) } }
        @keyframes dc-fall  { from { transform: translateY(-10vh) }  to { transform: translateY(110vh) } }
        @media (prefers-reduced-motion: reduce) {
          .dc-particle { animation: none !important; }
        }
      `}</style>

      {particles.map((p) => {
        const isCloud = field.weather === 'clouds';
        const isFalling = field.weather === 'snow' || field.weather === 'leaves';
        const animation = isCloud ? 'dc-drift' : isFalling ? 'dc-fall' : 'dc-rise';

        return (
          <div
            key={p.id}
            className="dc-particle"
            style={{
              position: 'absolute',
              left: `${p.left}vw`,
              top: `${p.top}vh`,
              width: p.size,
              height: isCloud ? p.size * 0.22 : field.weather === 'leaves' ? 6 : 4,
              borderRadius: field.weather === 'leaves' ? 2 : 999,
              background: field.weather === 'leaves' ? '#E08A3C' : '#fff',
              // 視認性を損なわないよう、かなり薄くする
              opacity: 0.09,
              filter: isCloud ? 'blur(6px)' : undefined,
              animation: `${animation} ${p.duration}s linear infinite`,
              animationDelay: `${p.delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}
