/**
 * ターンバーと操作ボタン。
 *
 * ターンバーは画面中央に置き、
 *   左   … 今どちらの番か
 *   中央 … 直前に何が起きたか(ログ1行)
 *   右   … 今どのフェーズか
 * を常に見えるようにする。
 *
 * 【デザイン: サイバーHUD】
 * 角を斜めに切り落とした帯に、シアンの細線と等幅数字を載せる。
 * 自分の番のときだけ左端のバーが明滅し、目線がそこへ行くようにしている。
 */

import type { LogEntry, Phase } from '../types/game';
import { PHASE_LABEL } from '../game/engine/phaseSystem';
import {
  ACCENT,
  GLASS,
  INK,
  NEON,
  VOID,
  clipDiagonal,
} from '../ui/tokens';

/* ===== ターンバー ===== */

export interface TurnBarProps {
  isMyTurn: boolean;
  opponentName: string;
  turnNumber: number;
  phase: Phase;
  lastLog: LogEntry | undefined;
  scale: number;
  onLogTap: () => void;
  /** 対戦をやめる。バーの左端に小さく置く。 */
  onExit?: () => void;
}

/** プレイヤーが意識するフェーズ(ドローは自動なので出さない) */
const VISIBLE_PHASES: Phase[] = ['mana', 'main', 'attack'];

export function TurnBar({
  isMyTurn,
  opponentName,
  turnNumber,
  phase,
  lastLog,
  scale,
  onLogTap,
  onExit,
}: TurnBarProps) {
  const turnColor = isMyTurn ? ACCENT.gold : NEON.core;

  return (
    <div
      style={{
        position: 'relative',
        height: 80 * scale,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 16 * scale,
        padding: `0 ${18 * scale}px 0 ${14 * scale}px`,
        margin: `${6 * scale}px 0`,
        clipPath: clipDiagonal(Math.max(5, 12 * scale)),
        background: `linear-gradient(90deg,${GLASS.panel},rgba(7,16,31,0.62))`,
        backdropFilter: GLASS.blur,
        boxShadow: `inset 0 0 0 1px ${GLASS.edgeSoft}`,
      }}
    >
      {/* 今どちらの番か。左端の縦バーで色分けし、自分の番なら明滅させる。 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 * scale }}>
        {/*
          退出ボタンはここに置く。画面の隅に浮かせるとゾーン名と重なり、
          ノッチのある端末では押せなくなるため。
        */}
        {onExit && (
          <button
            onClick={onExit}
            aria-label="対戦をやめる"
            style={{
              width: 30 * scale,
              height: 30 * scale,
              marginRight: 2 * scale,
              flexShrink: 0,
              border: 'none',
              clipPath: clipDiagonal(Math.max(3, 7 * scale)),
              background: 'rgba(4,7,15,0.7)',
              boxShadow: `inset 0 0 0 1px ${NEON.faint}`,
              color: INK.dim,
              fontSize: 14 * scale,
              lineHeight: 1,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ←
          </button>
        )}
        <div
          className={isMyTurn ? 'hud-pulse' : undefined}
          style={{
            width: Math.max(2, 3 * scale),
            height: 42 * scale,
            background: turnColor,
            boxShadow: `0 0 ${10 * scale}px ${turnColor}`,
          }}
        />
        <div>
          <div
            style={{
              fontSize: 21 * scale,
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: isMyTurn ? ACCENT.gold : INK.base,
              textShadow: isMyTurn
                ? `0 0 ${12 * scale}px rgba(255,197,61,0.5)`
                : 'none',
            }}
          >
            {isMyTurn ? 'あなたの番' : `${opponentName} の番`}
          </div>
          <div
            className="hud-num hud-label"
            style={{ fontSize: 10 * scale, color: INK.dim, marginTop: 2 * scale }}
          >
            TURN {String(turnNumber).padStart(2, '0')}
          </div>
        </div>
      </div>

      {/* 直前の出来事。端末の記録らしく「>」を付ける。 */}
      <div
        onClick={onLogTap}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8 * scale,
          minWidth: 0,
          cursor: 'pointer',
          padding: `${5 * scale}px ${10 * scale}px`,
          clipPath: clipDiagonal(Math.max(3, 6 * scale)),
          background: 'rgba(4,7,15,0.55)',
          boxShadow: `inset 0 0 0 1px ${NEON.ghost}`,
        }}
      >
        <span
          className="hud-num"
          style={{ color: NEON.core, fontSize: 12 * scale, flexShrink: 0 }}
        >
          &gt;
        </span>
        <span
          style={{
            fontSize: 13 * scale,
            color: INK.dim,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {lastLog?.text ?? '対戦開始'}
        </span>
      </div>

      {/* フェーズ。進行方向が分かるよう、間を細線でつなぐ。 */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {VISIBLE_PHASES.map((p, i) => {
          const active = phase === p;
          return (
            <div key={p} style={{ display: 'flex', alignItems: 'center' }}>
              {i > 0 && (
                <div
                  style={{
                    width: 10 * scale,
                    height: 1,
                    background: NEON.faint,
                  }}
                />
              )}
              <div
                className="hud-label"
                style={{
                  fontSize: 11 * scale,
                  fontWeight: 700,
                  padding: `${6 * scale}px ${13 * scale}px`,
                  clipPath: clipDiagonal(Math.max(3, 7 * scale)),
                  color: active ? VOID.base : INK.dim,
                  background: active ? NEON.core : 'rgba(34,211,238,0.06)',
                  boxShadow: active
                    ? `0 0 ${12 * scale}px ${NEON.glow}`
                    : `inset 0 0 0 1px ${NEON.faint}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {PHASE_LABEL[p]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===== 操作ボタン ===== */

export interface ActionButtonsProps {
  scale: number;
  phase: Phase;
  /** 自分の操作を受け付けられる状態か */
  enabled: boolean;
  /** 選択中のものがあり、キャンセルできる状態か */
  canCancel: boolean;
  onCancel: () => void;
  onToMain: () => void;
  onToAttack: () => void;
  onEndTurn: () => void;
}

export function ActionButtons({
  scale,
  phase,
  enabled,
  canCancel,
  onCancel,
  onToMain,
  onToAttack,
  onEndTurn,
}: ActionButtonsProps) {
  const base: React.CSSProperties = {
    fontFamily: 'inherit',
    fontWeight: 800,
    letterSpacing: '0.06em',
    color: INK.base,
    cursor: 'pointer',
    border: 'none',
    clipPath: clipDiagonal(Math.max(5, 12 * scale)),
    height: 72 * scale,
    width: 160 * scale,
    fontSize: 15 * scale,
    background: GLASS.panel,
    backdropFilter: GLASS.blur,
    boxShadow: `inset 0 0 0 1px ${NEON.faint}`,
    transition: 'filter 120ms',
  };

  const disabledStyle: React.CSSProperties = {
    opacity: 0.3,
    cursor: 'not-allowed',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 10 * scale,
      }}
    >
      <button
        onClick={onCancel}
        disabled={!canCancel}
        style={{
          ...base,
          color: INK.dim,
          background: 'rgba(11,20,38,0.75)',
          ...(canCancel ? {} : disabledStyle),
        }}
      >
        キャンセル
      </button>

      {/* マナフェーズでは「メインへ進む」、メインでは「攻撃へ進む」を出す */}
      {phase === 'mana' && (
        <button
          onClick={onToMain}
          disabled={!enabled}
          style={{ ...phaseButton(base, scale), ...(enabled ? {} : disabledStyle) }}
        >
          メインへ
        </button>
      )}
      {phase === 'main' && (
        <button
          onClick={onToAttack}
          disabled={!enabled}
          style={{ ...phaseButton(base, scale), ...(enabled ? {} : disabledStyle) }}
        >
          攻撃へ
        </button>
      )}
      {phase === 'attack' && (
        <button
          onClick={onToMain}
          disabled={!enabled}
          style={{ ...phaseButton(base, scale), ...(enabled ? {} : disabledStyle) }}
        >
          メインに戻る
        </button>
      )}

      <button
        onClick={onEndTurn}
        disabled={!enabled}
        style={{
          ...base,
          width: 220 * scale,
          fontSize: 17 * scale,
          background: `linear-gradient(180deg,${ACCENT.gold},#D89A12)`,
          color: '#1A1200',
          boxShadow: enabled
            ? `0 0 ${16 * scale}px rgba(255,197,61,0.45), inset 0 0 0 1px rgba(255,236,178,0.7)`
            : 'none',
          ...(enabled ? {} : disabledStyle),
        }}
      >
        ターン終了
      </button>
    </div>
  );
}

/** フェーズを進めるボタンの見た目(シアン寄りの濃紺) */
function phaseButton(
  base: React.CSSProperties,
  scale: number
): React.CSSProperties {
  return {
    ...base,
    background: `linear-gradient(180deg,${ACCENT.navy},#062334)`,
    color: NEON.bright,
    boxShadow: `inset 0 0 0 1px ${NEON.dim}, 0 0 ${12 * scale}px rgba(34,211,238,0.25)`,
  };
}

/* ===== ログ全文 ===== */

export interface GameLogProps {
  log: LogEntry[];
  onClose: () => void;
}

export function GameLog({ log, onClose }: GameLogProps) {
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
        background: 'rgba(3,6,12,0.78)',
        backdropFilter: 'blur(5px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '80svh',
          overflowY: 'auto',
          clipPath: clipDiagonal(16),
          background: GLASS.panel,
          backdropFilter: GLASS.blur,
          boxShadow: `inset 0 0 0 1px ${GLASS.edge}`,
          padding: 22,
          color: INK.base,
        }}
      >
        <h2
          className="hud-label"
          style={{
            fontSize: 13,
            fontWeight: 800,
            marginBottom: 14,
            color: NEON.core,
          }}
        >
          対戦ログ
        </h2>
        {/* 新しいものを上に出す */}
        {[...log].reverse().map((entry, i) => (
          <div
            key={i}
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              padding: '5px 0',
              borderBottom: `1px solid ${NEON.ghost}`,
              color: entry.kind === 'effect' ? ACCENT.gold : INK.base,
            }}
          >
            <span
              className="hud-num"
              style={{ color: NEON.dim, fontSize: 11, marginRight: 10 }}
            >
              T{String(entry.turn).padStart(2, '0')}
            </span>
            {entry.text}
          </div>
        ))}
        <button
          onClick={onClose}
          style={{
            marginTop: 18,
            width: '100%',
            padding: '13px',
            border: 'none',
            clipPath: clipDiagonal(10),
            background: 'rgba(34,211,238,0.12)',
            boxShadow: `inset 0 0 0 1px ${NEON.dim}`,
            color: NEON.bright,
            fontFamily: 'inherit',
            fontWeight: 800,
            letterSpacing: '0.08em',
            cursor: 'pointer',
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
