/**
 * ルームの作成・参加・状態同期。
 *
 * Firestore の onSnapshot を使い、相手の操作が即座に自分の画面へ反映されるようにする
 * (定期的に問い合わせるポーリングは書かなくてよい)。
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb } from './firebase';
import type { GameState, Seat } from '../types/game';
import type { RoomData, RoomPlayer, RoomStatus } from './roomTypes';
import { generateRoomCode, normalizeRoomCode } from './roomTypes';

const COLLECTION = 'rooms';

function roomRef(code: string) {
  return doc(getDb(), COLLECTION, code);
}

/** 空のプレイヤー情報を作る */
function emptyPlayer(name: string): RoomPlayer {
  return { name, ready: false, deckCardIds: [], lastSeen: Date.now() };
}

/**
 * 新しいルームを作る。作成者は p1 になる。
 *
 * コードが既に使われていた場合は、空くまで作り直す
 * (6桁で約9億通りあるため、実際にはほぼ衝突しない)。
 */
export async function createRoom(
  hostName: string
): Promise<{ code: string; seat: Seat }> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode();
    const snap = await getDoc(roomRef(code));
    if (snap.exists()) continue;

    const data: RoomData = {
      code,
      status: 'waiting',
      p1: emptyPlayer(hostName),
      p2: null,
      game: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      sharedCardIds: [],
    };
    await setDoc(roomRef(code), data);
    return { code, seat: 'p1' };
  }
  throw new Error('部屋を作成できませんでした。もう一度お試しください。');
}

/** 参加時の結果 */
export type JoinResult =
  | { ok: true; seat: Seat; room: RoomData }
  | { ok: false; reason: 'notFound' | 'full' | 'finished' };

/**
 * 既存のルームに参加する。
 *
 * 同じ名前で入り直した場合は元の席に戻れるようにしてある
 * (通信が切れて入り直したときに、席が埋まっていて入れないと困るため)。
 */
export async function joinRoom(
  inputCode: string,
  playerName: string
): Promise<JoinResult> {
  const code = normalizeRoomCode(inputCode);
  const snap = await getDoc(roomRef(code));
  if (!snap.exists()) return { ok: false, reason: 'notFound' };

  const room = snap.data() as RoomData;
  if (room.status === 'finished') return { ok: false, reason: 'finished' };

  // 同名で入り直した場合は元の席へ復帰
  if (room.p1?.name === playerName) {
    await touchPlayer(code, 'p1');
    return { ok: true, seat: 'p1', room };
  }
  if (room.p2?.name === playerName) {
    await touchPlayer(code, 'p2');
    return { ok: true, seat: 'p2', room };
  }

  if (room.p2) return { ok: false, reason: 'full' };

  await updateDoc(roomRef(code), {
    p2: emptyPlayer(playerName),
    status: 'deckSelect' satisfies RoomStatus,
    updatedAt: Date.now(),
  });
  return { ok: true, seat: 'p2', room };
}

/** 最終通信時刻を更新する(接続が生きていることを相手に知らせる) */
export async function touchPlayer(code: string, seat: Seat): Promise<void> {
  await updateDoc(roomRef(code), {
    [`${seat}.lastSeen`]: Date.now(),
    updatedAt: Date.now(),
  });
}

/** 選んだデッキを登録し、準備完了にする */
export async function submitDeck(
  code: string,
  seat: Seat,
  deckCardIds: string[]
): Promise<void> {
  await updateDoc(roomRef(code), {
    [`${seat}.deckCardIds`]: deckCardIds,
    [`${seat}.ready`]: true,
    [`${seat}.lastSeen`]: Date.now(),
    updatedAt: Date.now(),
  });
}

/** 準備を取り消す(デッキを選び直す) */
export async function cancelReady(code: string, seat: Seat): Promise<void> {
  await updateDoc(roomRef(code), {
    [`${seat}.ready`]: false,
    updatedAt: Date.now(),
  });
}

/**
 * 対戦を開始する。
 *
 * 両者が同じ初期状態から始める必要があるため、
 * 山札のシャッフルなどを含む初期化は p1 側だけが行い、その結果を共有する。
 * (両者が別々にシャッフルすると、手札が食い違ってしまう)
 */
export async function startGame(
  code: string,
  game: GameState,
  sharedCardIds: string[]
): Promise<void> {
  await updateDoc(roomRef(code), {
    game,
    sharedCardIds,
    status: 'playing' satisfies RoomStatus,
    updatedAt: Date.now(),
  });
}

/**
 * 対戦状態を送信する。
 *
 * 自分が操作した結果を相手に伝えるために呼ぶ。
 * 勝敗が決まっている場合は、ルームの状態も finished にする。
 */
export async function pushGameState(
  code: string,
  game: GameState
): Promise<void> {
  const payload: Record<string, unknown> = {
    game,
    updatedAt: Date.now(),
  };
  if (game.winner) {
    payload.status = 'finished' satisfies RoomStatus;
  }
  await updateDoc(roomRef(code), payload);
}

/**
 * ルームの変化を購読する。
 *
 * 戻り値の関数を呼ぶと購読を解除できる。
 * 画面を離れるときに必ず呼び、通信を止めること。
 */
export function subscribeRoom(
  code: string,
  onChange: (room: RoomData) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  return onSnapshot(
    roomRef(code),
    (snap) => {
      if (!snap.exists()) return;
      onChange(snap.data() as RoomData);
    },
    (err) => {
      console.error('ルームの購読に失敗しました:', err);
      onError?.(err as Error);
    }
  );
}

/** 相手が接続を失っているとみなす閾値(ミリ秒) */
const DISCONNECT_THRESHOLD = 30_000;

/** 相手との接続が切れていそうか判定する */
export function looksDisconnected(player: RoomPlayer | null): boolean {
  if (!player) return false;
  return Date.now() - player.lastSeen > DISCONNECT_THRESHOLD;
}
