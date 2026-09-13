/**
 * オンライン対戦のルーム(部屋)に関する型定義。
 *
 * Firestore には room ドキュメントを1つ置き、その中に
 * 「両者の参加状況」と「対戦の全状態」を持たせる。
 *
 * 同期するのは GameState だけで、選択中カードやドラッグ位置といった
 * UIState は送らない。相手の操作が自分の画面に干渉しないようにするため。
 */

import type { GameState, Seat } from '../types/game';

/** ルームの進行段階 */
export type RoomStatus =
  | 'waiting' // 相手の参加待ち
  | 'deckSelect' // 両者がデッキを選んでいる
  | 'playing' // 対戦中
  | 'finished'; // 決着済み

/** 片方の参加者の情報 */
export interface RoomPlayer {
  name: string;
  /** デッキを選び終えて準備完了か */
  ready: boolean;
  /** 選んだデッキのカードid(40枚) */
  deckCardIds: string[];
  /** 最後に通信した時刻。接続が切れた相手を検出するのに使う。 */
  lastSeen: number;
}

/** Firestore に保存されるルームの中身 */
export interface RoomData {
  /** 部屋コード(共有用) */
  code: string;
  status: RoomStatus;
  p1: RoomPlayer | null;
  p2: RoomPlayer | null;
  /** 対戦が始まっていなければ null */
  game: GameState | null;
  createdAt: number;
  updatedAt: number;
  /**
   * 使用しているカードプール。
   * 相手が作ったカードもこちらで表示できるよう、対戦開始時に共有する。
   */
  sharedCardIds: string[];
}

/** 自分がどちらの席にいるか(ルームに入っていなければ null) */
export type MySeat = Seat | null;

/** 相手の席を返す */
export function opponentOf(seat: Seat): Seat {
  return seat === 'p1' ? 'p2' : 'p1';
}

/**
 * 部屋コードを生成する。
 *
 * 紛らわしい文字(0とO、1とIとl)を除いた文字種から6桁で作る。
 * 口頭やメッセージで伝える場面を想定しているため、読み間違いを避けたい。
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/** 入力された部屋コードを正規化する(小文字や空白を許容する) */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s/g, '');
}
