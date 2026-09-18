/**
 * ターンバーと操作ボタン。
 *
 * ターンバーは画面中央に置き、
 *   左   … 今どちらの番か
 *   中央 … 直前に何が起きたか(ログ1行)
 *   右   … 今どのフェーズか
 * を常に見えるようにする。
 */

import type { LogEntry, Phase } from '../types/game';
import { PHASE_LABEL } from '../game/engine/phaseSystem';
import { ACCENT, GLASS, INK } from '../ui/tokens';

/* ===== ターンバー ===== */

export interface TurnBarProps {
  isMyTurn: boolean;
  opponentName: string;
  turnNumber: number;
  phase: Phase;
  lastLog: LogEntry | undefined;
  scale: number;
  onLogTap: () => void;
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
}: TurnBarProps) {
  return (
    <div
      style={{
        height: 80 * scale,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        alignItems: 'center',
        gap: 20 * scale,
        padding: `0 ${20 * scale}px`,
        margin: `${6 * scale}px 0`,
        background: GLASS.panel,
        backdropFilter: GLASS.blur,
        border: `1px solid ${GLASS.edgeSoft}`,
        borderRadius: 12 * scale,
      }}
    >
      {/* 今どちらの番か。ここが画面で最も目立つようにする。 */}
      <div>
        <div
          style={{
            fontSize: 21 * scale,
            fontWeight: 800,
            letterSpacing: '0.02em',
            color: isMyTurn ? ACCENT.gold : INK.base,
          }}
        >
          {isMyTurn ? 'あなたの番' : `${opponentName} の番`}
        </div>
        <div style={{ fontSize: 11 * scale, color: INK.dim }}>
          ターン {turnNumber}
        </div>
      </div>

      {/* 直前の出来事 */}
      <div
        onClick={onLogTap}
        style={{
          fontSize: 14 * scale,
          color: INK.dim,
          textAlign: 'center',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          cursor: 'pointer',
        }}
      >
        {lastLog?.text ?? '対戦開始'}
      </div>

      {/* フェーズ */}
      <div style={{ display: 'flex', gap: 6 * scale }}>
        {VISIBLE_PHASES.map((p) => {
          const active = phase === p;
          return (
            <div
              key={p}
              style={{
                fontSize: 12 * scale,
                padding: `${6 * scale}px ${14 * scale}px`,
                borderRadius: 999,
                color: active ? '#fff' : INK.dim,
                background: active ? 'rgba(79,184,245,0.28)' : 'transparent',
                border: `1px solid ${active ? ACCENT.select : 'transparent'}`,
                whiteSpace: 'nowrap',
              }}
            >
              {PHASE_LABEL[p]}
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
    color: '#fff',
    cursor: 'pointer',
    borderRadius: 12 * scale,
    border: `1px solid ${GLASS.edge}`,
    height: 72 * scale,
    width: 160 * scale,
    fontSize: 15 * scale,
    background: GLASS.panel,
    backdropFilter: GLASS.blur,
    transition: 'filter 120ms',
  };

  const disabledStyle: React.CSSProperties = {
    opacity: 0.35,
    cursor: 'not-allowed',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12 * scale,
      }}
    >
      <button
        onClick={onCancel}
        disabled={!canCancel}
        style={{
          ...base,
          background: 'rgba(90,104,128,0.6)',
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
          style={{
            ...base,
            background: ACCENT.navy,
            ...(enabled ? {} : disabledStyle),
          }}
        >
          メインへ
        </button>
      )}
      {phase === 'main' && (
        <button
          onClick={onToAttack}
          disabled={!enabled}
          style={{
            ...base,
            background: ACCENT.navy,
            ...(enabled ? {} : disabledStyle),
          }}
        >
          攻撃へ
        </button>
      )}
      {phase === 'attack' && (
        <button
          onClick={onToMain}
          disabled={!enabled}
          style={{
            ...base,
            background: ACCENT.navy,
            ...(enabled ? {} : disabledStyle),
          }}
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
          background: 'linear-gradient(180deg,#FFDE72,#E8B21F)',
          color: '#3A2A00',
          border: `1px solid rgba(255,255,255,0.5)`,
          ...(enabled ? {} : disabledStyle),
        }}
      >
        ターン終了
      </button>
    </div>
  );
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
        background: 'rgba(8,14,28,0.72)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 560,
          maxHeight: '80svh',
          overflowY: 'auto',
          background: GLASS.panel,
          backdropFilter: GLASS.blur,
          border: `1px solid ${GLASS.edge}`,
          borderRadius: 16,
          padding: 20,
          color: INK.base,
        }}
      >
        <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>
          対戦ログ
        </h2>
        {/* 新しいものを上に出す */}
        {[...log].reverse().map((entry, i) => (
          <div
            key={i}
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              padding: '4px 0',
              borderBottom: `1px solid ${GLASS.edgeSoft}`,
              color: entry.kind === 'effect' ? ACCENT.gold : INK.base,
            }}
          >
            <span style={{ color: INK.dim, fontSize: 11, marginRight: 8 }}>
              T{entry.turn}
            </span>
            {entry.text}
          </div>
        ))}
        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            border: `1px solid ${GLASS.edge}`,
            background: 'rgba(255,255,255,0.1)',
            color: INK.base,
            fontFamily: 'inherit',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
