/**
 * 入力フォームの共通部品。
 *
 * カード作成画面など、設定を入力する画面はここの部品だけで組む。
 * 見た目(サイバーHUD)を1か所にまとめることで、
 * 画面が増えても雰囲気がばらつかないようにしている。
 *
 * 【スマートフォンへの配慮】
 *   ・入力欄の文字は16px以上にする
 *     (iOSはこれより小さいと、タップした瞬間に画面を勝手に拡大してしまう)
 *   ・押せるものは高さ44px以上を確保する
 */

import type { ReactNode } from 'react';
import { GLASS, INK, NEON, VOID, clipDiagonal } from '../ui/tokens';

/* ===== 区画 ===== */

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        position: 'relative',
        clipPath: clipDiagonal(14),
        background: GLASS.panel,
        boxShadow: `inset 0 0 0 1px ${GLASS.edgeSoft}`,
        padding: 18,
        marginBottom: 14,
      }}
    >
      <h2
        className="hud-label"
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: NEON.core,
          marginBottom: note ? 4 : 14,
        }}
      >
        {title}
      </h2>
      {note && (
        <p style={{ fontSize: 11, color: INK.dim, marginBottom: 14, lineHeight: 1.6 }}>
          {note}
        </p>
      )}
      {children}
    </section>
  );
}

/** 入力欄1つ分の枠(ラベル + 中身 + 補足) */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <span
        style={{
          display: 'block',
          fontSize: 12,
          color: INK.dim,
          marginBottom: 6,
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
      {children}
      {hint && (
        <span
          style={{
            display: 'block',
            fontSize: 11,
            color: INK.dim,
            marginTop: 5,
            lineHeight: 1.6,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '11px 12px',
  border: 'none',
  clipPath: clipDiagonal(7),
  boxShadow: `inset 0 0 0 1px ${GLASS.edgeSoft}`,
  background: 'rgba(4,7,15,0.7)',
  color: NEON.bright,
  fontFamily: 'inherit',
  // 16px未満にするとiOSが勝手に拡大するため下げない
  fontSize: 16,
};

export function TextInput({
  value,
  onChange,
  placeholder,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      style={inputStyle}
    />
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
    />
  );
}

/**
 * 数値入力。
 * スマートフォンでも増減しやすいよう、左右に「−」「＋」を置いている。
 */
export function NumberInput({
  value,
  onChange,
  min = 0,
  max = 99999,
  step = 1,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const stepButton: React.CSSProperties = {
    width: 46,
    height: 44,
    flexShrink: 0,
    border: 'none',
    clipPath: clipDiagonal(7),
    background: 'rgba(34,211,238,0.10)',
    boxShadow: `inset 0 0 0 1px ${NEON.faint}`,
    color: NEON.bright,
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
      <button type="button" onClick={() => onChange(clamp(value - step))} style={stepButton}>
        −
      </button>
      <input
        className="hud-num"
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        style={{ ...inputStyle, textAlign: 'center', minWidth: 0 }}
      />
      <button type="button" onClick={() => onChange(clamp(value + step))} style={stepButton}>
        ＋
      </button>
    </div>
  );
}

/**
 * 選択肢を横並びのボタンで選ぶ。
 * プルダウンより指で押しやすく、選択中のものが一目で分かる。
 */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  colorOf,
  multiple = false,
  values,
  onToggle,
}: {
  options: { value: T; label: string }[];
  /** 単一選択のとき使う */
  value?: T;
  onChange?: (v: T) => void;
  /** 選択肢ごとに色を変えたい場合(文明など) */
  colorOf?: (v: T) => string;
  /** 複数選択にする */
  multiple?: boolean;
  values?: T[];
  onToggle?: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {options.map((opt) => {
        const active = multiple
          ? (values ?? []).includes(opt.value)
          : value === opt.value;
        const tint = colorOf?.(opt.value) ?? NEON.core;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() =>
              multiple ? onToggle?.(opt.value) : onChange?.(opt.value)
            }
            style={{
              minHeight: 44,
              padding: '10px 15px',
              border: 'none',
              clipPath: clipDiagonal(7),
              background: active ? tint : 'rgba(4,7,15,0.6)',
              boxShadow: active
                ? `0 0 12px ${tint}66`
                : `inset 0 0 0 1px ${GLASS.edgeSoft}`,
              color: active ? VOID.base : INK.dim,
              fontWeight: active ? 800 : 600,
              fontSize: 13,
              letterSpacing: '0.04em',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** 有効/無効を切り替える1行。キーワード能力の設定に使う。 */
export function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        minHeight: 44,
        padding: '10px 12px',
        marginBottom: 6,
        textAlign: 'left',
        border: 'none',
        clipPath: clipDiagonal(7),
        background: checked ? 'rgba(34,211,238,0.12)' : 'rgba(4,7,15,0.45)',
        boxShadow: `inset 0 0 0 1px ${checked ? NEON.dim : GLASS.edgeSoft}`,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {/* チェックの印。四角に斜めの角を落として統一感を出す。 */}
      <span
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          clipPath: clipDiagonal(5),
          background: checked ? NEON.core : 'transparent',
          boxShadow: `inset 0 0 0 1px ${checked ? NEON.core : GLASS.edge}`,
          color: VOID.base,
          fontSize: 13,
          fontWeight: 900,
          lineHeight: '20px',
          textAlign: 'center',
        }}
      >
        {checked ? '✓' : ''}
      </span>
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 700,
            color: checked ? NEON.bright : INK.base,
          }}
        >
          {label}
        </span>
        {description && (
          <span
            style={{
              display: 'block',
              fontSize: 11,
              color: INK.dim,
              marginTop: 2,
              lineHeight: 1.5,
            }}
          >
            {description}
          </span>
        )}
      </span>
    </button>
  );
}

/* ===== ボタン ===== */

export type ButtonTone = 'primary' | 'normal' | 'danger';

export function Button({
  children,
  onClick,
  tone = 'normal',
  full = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  tone?: ButtonTone;
  full?: boolean;
  disabled?: boolean;
}) {
  const tones: Record<ButtonTone, React.CSSProperties> = {
    primary: {
      background: 'linear-gradient(180deg,#FFC53D,#D89A12)',
      color: '#1A1200',
      boxShadow: '0 0 16px rgba(255,197,61,0.45)',
    },
    normal: {
      background: 'rgba(34,211,238,0.10)',
      color: NEON.bright,
      boxShadow: `inset 0 0 0 1px ${NEON.dim}`,
    },
    danger: {
      background: 'rgba(255,77,109,0.12)',
      color: '#FF8DA3',
      boxShadow: 'inset 0 0 0 1px rgba(255,77,109,0.55)',
    },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        minHeight: 46,
        width: full ? '100%' : undefined,
        padding: '13px 20px',
        border: 'none',
        clipPath: clipDiagonal(10),
        fontWeight: 800,
        fontSize: 14,
        letterSpacing: '0.08em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.35 : 1,
        ...tones[tone],
      }}
    >
      {children}
    </button>
  );
}

/** 入力の不備を伝える帯 */
export function Notice({
  tone = 'warn',
  children,
}: {
  tone?: 'warn' | 'error' | 'ok';
  children: ReactNode;
}) {
  const color =
    tone === 'error' ? '#FF4D6D' : tone === 'ok' ? '#2FE39B' : '#FFC53D';
  return (
    <div
      style={{
        padding: '11px 14px',
        marginBottom: 12,
        clipPath: clipDiagonal(8),
        background: `${color}14`,
        boxShadow: `inset 0 0 0 1px ${color}66`,
        color,
        fontSize: 12,
        lineHeight: 1.7,
      }}
    >
      {children}
    </div>
  );
}
