/**
 * タップ・長押し・ドラッグを判別するためのフック。
 *
 * 3つの操作が同じ「指で押す」動作から始まるため、
 * 誤爆しないよう1か所で判定する。
 *
 *   押した直後          … まだ何も確定しない
 *   500ms 押し続けた    … 長押し(カード詳細を開く)
 *   10px以上動かした    … ドラッグ開始(長押しは取り消す)
 *   それ以外で離した     … タップ
 *
 * マウスとタッチの両方に対応するため Pointer Events を使っている。
 */

import { useCallback, useRef } from 'react';
import { LONG_PRESS_MS } from './tokens';

/** ドラッグと判定する移動距離(px) */
const DRAG_THRESHOLD = 10;

export interface PressHandlers {
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: (e: React.PointerEvent) => void;
  /** 長押しでブラウザ標準のメニューが出ないようにする */
  onContextMenu: (e: React.MouseEvent) => void;
}

export interface UsePressOptions {
  onTap?: () => void;
  onLongPress?: () => void;
  /** ドラッグ開始。ドラッグを使わない要素では省略する。 */
  onDragStart?: (point: { x: number; y: number }) => void;
  onDragMove?: (point: { x: number; y: number }) => void;
  onDragEnd?: (point: { x: number; y: number }) => void;
  /** trueの間は操作を受け付けない */
  disabled?: boolean;
}

export function usePress(options: UsePressOptions): PressHandlers {
  const {
    onTap,
    onLongPress,
    onDragStart,
    onDragMove,
    onDragEnd,
    disabled = false,
  } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef(false);
  const longPressedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      // 指を離すまでこの要素がイベントを受け取り続けるようにする
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

      startRef.current = { x: e.clientX, y: e.clientY };
      draggingRef.current = false;
      longPressedRef.current = false;

      if (onLongPress) {
        clearTimer();
        timerRef.current = setTimeout(() => {
          // 動かさずに押し続けていた場合のみ長押しとする
          if (!draggingRef.current) {
            longPressedRef.current = true;
            onLongPress();
          }
        }, LONG_PRESS_MS);
      }
    },
    [disabled, onLongPress, clearTimer]
  );

  const handleMove = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || !startRef.current) return;

      const dx = e.clientX - startRef.current.x;
      const dy = e.clientY - startRef.current.y;
      const moved = Math.hypot(dx, dy);

      if (!draggingRef.current && moved > DRAG_THRESHOLD) {
        // 動かし始めたので長押しは取り消す
        clearTimer();
        if (onDragStart && !longPressedRef.current) {
          draggingRef.current = true;
          onDragStart({ x: e.clientX, y: e.clientY });
        }
      }

      if (draggingRef.current) {
        onDragMove?.({ x: e.clientX, y: e.clientY });
      }
    },
    [disabled, onDragStart, onDragMove, clearTimer]
  );

  const handleUp = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      clearTimer();

      if (draggingRef.current) {
        onDragEnd?.({ x: e.clientX, y: e.clientY });
      } else if (!longPressedRef.current) {
        // 動かさず、長押しにもならなかった → タップ
        onTap?.();
      }

      startRef.current = null;
      draggingRef.current = false;
      longPressedRef.current = false;
    },
    [disabled, onTap, onDragEnd, clearTimer]
  );

  const handleCancel = useCallback(() => {
    clearTimer();
    startRef.current = null;
    draggingRef.current = false;
    longPressedRef.current = false;
  }, [clearTimer]);

  return {
    onPointerDown: handleDown,
    onPointerMove: handleMove,
    onPointerUp: handleUp,
    onPointerCancel: handleCancel,
    onContextMenu: (e) => e.preventDefault(),
  };
}
