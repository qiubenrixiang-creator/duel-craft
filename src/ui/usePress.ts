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
  /**
   * touch-action: none などをまとめて当てるためのクラス。
   * これが無いと、iOSではスクロール判定に操作を奪われてタップが効かない。
   */
  className: string;
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
  /** 押し始めた時刻。取り消された時にタップだったか判断するのに使う。 */
  const startTimeRef = useRef(0);
  const movedRef = useRef(0);
  /** 最後に指があった位置(操作が打ち切られた時の着地点に使う) */
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      // 指を離すまでこの要素がイベントを受け取り続けるようにする。
      // 一部の環境では失敗することがあるため、失敗しても処理を続ける。
      try {
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      } catch {
        /* 捕捉できなくてもタップ判定自体はできる */
      }

      startRef.current = { x: e.clientX, y: e.clientY };
      lastRef.current = { x: e.clientX, y: e.clientY };
      startTimeRef.current = Date.now();
      movedRef.current = 0;
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
      movedRef.current = Math.max(movedRef.current, moved);
      lastRef.current = { x: e.clientX, y: e.clientY };

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
      lastRef.current = null;
      movedRef.current = 0;
      draggingRef.current = false;
      longPressedRef.current = false;
    },
    [disabled, onTap, onDragEnd, clearTimer]
  );

  /**
   * ブラウザ側の都合で操作が打ち切られた時(pointercancel)。
   *
   * iOSのSafariは、指の動きをスクロールだと判断すると、こちらの操作を
   * 途中で取り消してしまう。そのまま捨てるとタップが効かなくなるため、
   * 「短く・ほとんど動かさずに」押されていた場合はタップとして扱う。
   */
  const handleCancel = useCallback(() => {
    clearTimer();

    const wasQuickTap =
      startRef.current !== null &&
      !draggingRef.current &&
      !longPressedRef.current &&
      movedRef.current <= DRAG_THRESHOLD &&
      Date.now() - startTimeRef.current < LONG_PRESS_MS;

    if (draggingRef.current) {
      onDragEnd?.(lastRef.current ?? { x: 0, y: 0 });
    } else if (wasQuickTap && !disabled) {
      onTap?.();
    }

    startRef.current = null;
    lastRef.current = null;
    movedRef.current = 0;
    draggingRef.current = false;
    longPressedRef.current = false;
  }, [clearTimer, disabled, onTap, onDragEnd]);

  return {
    onPointerDown: handleDown,
    onPointerMove: handleMove,
    onPointerUp: handleUp,
    onPointerCancel: handleCancel,
    onContextMenu: (e) => e.preventDefault(),
    className: 'dc-press-area',
  };
}
