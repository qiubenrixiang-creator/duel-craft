/**
 * 端末内へのデータ保存。
 *
 * 作成したカード・保存したデッキ・背景設定は、その人の端末にだけ保存する。
 * Firebaseを設定していなくても、カード作成からNPC対戦まで一通り遊べるようにするため。
 *
 * 保存に失敗しても例外を投げず false を返す。
 * (ブラウザの設定によっては localStorage が使えないことがあるため、
 *  その場合でもアプリが落ちないようにする)
 */

import type { Card } from '../types/card';
import type { BackgroundSetting } from '../types/ui';

const KEY_CARDS = 'duelcraft:cards';
const KEY_DECKS = 'duelcraft:decks';
const KEY_BACKGROUND = 'duelcraft:background';
const KEY_PLAYER_NAME = 'duelcraft:playerName';

/** 保存されたデッキ1つ */
export interface SavedDeck {
  id: string;
  name: string;
  cardIds: string[];
  updatedAt: number;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ===== カードプール ===== */

export function loadCards(): Card[] {
  return read<Card[]>(KEY_CARDS) ?? [];
}

/**
 * カードを保存する。
 *
 * 画像をBase64で持つため、カードが増えると容量を圧迫しうる。
 * 保存に失敗した場合は false を返すので、呼び出し側で
 * 「画像を減らしてください」といった案内を出せる。
 */
export function saveCards(cards: Card[]): boolean {
  return write(KEY_CARDS, cards);
}

/* ===== デッキ ===== */

export function loadDecks(): SavedDeck[] {
  return read<SavedDeck[]>(KEY_DECKS) ?? [];
}

export function saveDecks(decks: SavedDeck[]): boolean {
  return write(KEY_DECKS, decks);
}

/* ===== 設定 ===== */

export function loadBackground(): BackgroundSetting | null {
  return read<BackgroundSetting>(KEY_BACKGROUND);
}

export function saveBackground(setting: BackgroundSetting): boolean {
  return write(KEY_BACKGROUND, setting);
}

export function loadPlayerName(): string {
  return read<string>(KEY_PLAYER_NAME) ?? '';
}

export function savePlayerName(name: string): boolean {
  return write(KEY_PLAYER_NAME, name);
}

/**
 * 保存領域の使用量のおおよそを返す(バイト)。
 * 画像付きカードを増やしすぎた場合に警告を出すために使う。
 */
export function estimateUsage(): number {
  let total = 0;
  for (const key of [KEY_CARDS, KEY_DECKS, KEY_BACKGROUND]) {
    try {
      total += (localStorage.getItem(key) ?? '').length;
    } catch {
      /* 取得できない場合は0として扱う */
    }
  }
  return total;
}
