/**
 * ルームへの接続を React から扱うためのフック。
 *
 * ここで扱うのは通信だけで、ゲームのルール判定は一切行わない。
 *
 * 注意している点:
 *   自分が操作した直後に、まだ反映されていない古い状態が相手から届くと
 *   操作が巻き戻って見えることがある。これを防ぐため、送信した直後は
 *   一定時間だけ受信を無視する(自分の操作を優先する)。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameState, Seat } from '../types/game';
import type { RoomData } from './roomTypes';
import {
  cancelReady,
  createRoom,
  joinRoom,
  pushGameState,
  startGame,
  submitDeck,
  subscribeRoom,
  touchPlayer,
  type JoinResult,
} from './roomService';

/** 自分の送信が反映されるまで、受信を無視する時間 */
const ECHO_GUARD_MS = 1200;

/** 接続を維持していることを相手に知らせる間隔 */
const HEARTBEAT_MS = 10_000;

export interface UseRoomResult {
  room: RoomData | null;
  seat: Seat | null;
  error: string | null;
  connecting: boolean;
  /** 新しい部屋を作る */
  create: (hostName: string) => Promise<string | null>;
  /** 既存の部屋に入る */
  join: (code: string, playerName: string) => Promise<JoinResult>;
  /** 部屋から出る(購読を解除する) */
  leave: () => void;
  /** デッキを登録して準備完了にする */
  ready: (deckCardIds: string[]) => Promise<void>;
  /** 準備を取り消す */
  unready: () => Promise<void>;
  /** 対戦を開始する(p1のみが呼ぶ) */
  begin: (game: GameState, sharedCardIds: string[]) => Promise<void>;
  /** 自分の操作結果を送信する */
  send: (game: GameState) => Promise<void>;
}

export function useRoom(): UseRoomResult {
  const [room, setRoom] = useState<RoomData | null>(null);
  const [seat, setSeat] = useState<Seat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const codeRef = useRef<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  /** 最後に自分が送信した時刻。これ以降しばらくは受信を無視する。 */
  const lastSentRef = useRef<number>(0);

  /** 購読を開始する */
  const startSubscription = useCallback((code: string) => {
    unsubRef.current?.();
    unsubRef.current = subscribeRoom(
      code,
      (data) => {
        // 自分の送信直後は、古い状態で上書きされるのを避ける
        if (Date.now() - lastSentRef.current < ECHO_GUARD_MS) return;
        setRoom(data);
      },
      (err) => setError(err.message)
    );
  }, []);

  const create = useCallback(
    async (hostName: string): Promise<string | null> => {
      setConnecting(true);
      setError(null);
      try {
        const { code, seat: mySeat } = await createRoom(hostName);
        codeRef.current = code;
        setSeat(mySeat);
        startSubscription(code);
        return code;
      } catch (e) {
        setError(e instanceof Error ? e.message : '部屋を作成できませんでした。');
        return null;
      } finally {
        setConnecting(false);
      }
    },
    [startSubscription]
  );

  const join = useCallback(
    async (code: string, playerName: string): Promise<JoinResult> => {
      setConnecting(true);
      setError(null);
      try {
        const result = await joinRoom(code, playerName);
        if (result.ok) {
          codeRef.current = result.room.code;
          setSeat(result.seat);
          startSubscription(result.room.code);
        } else {
          const messages = {
            notFound: 'その部屋コードは見つかりませんでした。',
            full: 'その部屋はすでに2人が入っています。',
            finished: 'その部屋の対戦はすでに終了しています。',
          };
          setError(messages[result.reason]);
        }
        return result;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : '部屋に参加できませんでした。';
        setError(message);
        return { ok: false, reason: 'notFound' };
      } finally {
        setConnecting(false);
      }
    },
    [startSubscription]
  );

  const leave = useCallback(() => {
    unsubRef.current?.();
    unsubRef.current = null;
    codeRef.current = null;
    setRoom(null);
    setSeat(null);
    setError(null);
  }, []);

  const ready = useCallback(
    async (deckCardIds: string[]) => {
      if (!codeRef.current || !seat) return;
      await submitDeck(codeRef.current, seat, deckCardIds);
    },
    [seat]
  );

  const unready = useCallback(async () => {
    if (!codeRef.current || !seat) return;
    await cancelReady(codeRef.current, seat);
  }, [seat]);

  const begin = useCallback(
    async (game: GameState, sharedCardIds: string[]) => {
      if (!codeRef.current) return;
      lastSentRef.current = Date.now();
      await startGame(codeRef.current, game, sharedCardIds);
    },
    []
  );

  const send = useCallback(async (game: GameState) => {
    if (!codeRef.current) return;
    lastSentRef.current = Date.now();
    // 送信前に自分の画面へ即座に反映する(通信を待たせない)
    setRoom((prev) => (prev ? { ...prev, game } : prev));
    try {
      await pushGameState(codeRef.current, game);
    } catch (e) {
      setError('通信に失敗しました。接続を確認してください。');
    }
  }, []);

  /** 接続が生きていることを定期的に知らせる */
  useEffect(() => {
    if (!codeRef.current || !seat) return;
    const id = setInterval(() => {
      if (codeRef.current && seat) {
        touchPlayer(codeRef.current, seat).catch(() => {
          /* 一時的な失敗は無視してよい */
        });
      }
    }, HEARTBEAT_MS);
    return () => clearInterval(id);
  }, [seat, room?.status]);

  /** 画面を離れるときに購読を解除する */
  useEffect(() => {
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, []);

  return {
    room,
    seat,
    error,
    connecting,
    create,
    join,
    leave,
    ready,
    unready,
    begin,
    send,
  };
}
