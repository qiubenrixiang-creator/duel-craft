/**
 * 収集データの保存と操作。
 *
 * コイン・所持カード・開封履歴を localStorage に保存し、
 * リロードしても消えないようにする。
 */

import type { CardPack, CollectionState, PackResultCard } from '../types/collection';
import { createInitialCollection } from '../types/collection';

const KEY_COLLECTION = 'duelcraft:collection';
const KEY_PACKS = 'duelcraft:packs';

/** 履歴の保持件数。増やしすぎると保存容量を圧迫するため上限を設ける。 */
const MAX_HISTORY = 50;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : (JSON.parse(raw) as T);
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

/* ===== 収集データ ===== */

export function loadCollection(): CollectionState {
  const saved = read<CollectionState>(KEY_COLLECTION);
  if (!saved) return createInitialCollection();

  // 古い保存データに項目が足りない場合に備えて補う
  return {
    coins: saved.coins ?? 1000,
    owned: saved.owned ?? {},
    history: saved.history ?? [],
    lastLoginDate: saved.lastLoginDate ?? '',
  };
}

export function saveCollection(state: CollectionState): boolean {
  return write(KEY_COLLECTION, state);
}

/* ===== パック定義 ===== */

export function loadPacks(): CardPack[] {
  return read<CardPack[]>(KEY_PACKS) ?? [];
}

export function savePacks(packs: CardPack[]): boolean {
  return write(KEY_PACKS, packs);
}

/* ===== 操作 ===== */

/** 所持しているカードidの集合を作る */
export function ownedCardIdSet(state: CollectionState): Set<string> {
  return new Set(
    Object.entries(state.owned)
      .filter(([, entry]) => entry.count > 0 || entry.secretCount > 0)
      .map(([cardId]) => cardId)
  );
}

/**
 * 開封結果を所持データへ反映する。
 * 元の state は変更せず、新しい state を返す。
 */
export function applyPackResult(
  state: CollectionState,
  packId: string,
  cards: PackResultCard[]
): CollectionState {
  const owned = { ...state.owned };
  const now = Date.now();

  for (const result of cards) {
    const prev = owned[result.cardId];
    if (prev) {
      owned[result.cardId] = {
        ...prev,
        count: prev.count + (result.isSecret ? 0 : 1),
        secretCount: prev.secretCount + (result.isSecret ? 1 : 0),
      };
    } else {
      owned[result.cardId] = {
        count: result.isSecret ? 0 : 1,
        secretCount: result.isSecret ? 1 : 0,
        firstObtainedAt: now,
        isNew: true,
      };
    }
  }

  const history = [
    { packId, openedAt: now, cards },
    ...state.history,
  ].slice(0, MAX_HISTORY);

  return { ...state, owned, history };
}

/** コインを消費する。足りなければ null を返す。 */
export function spendCoins(
  state: CollectionState,
  amount: number
): CollectionState | null {
  if (state.coins < amount) return null;
  return { ...state, coins: state.coins - amount };
}

/** コインを追加する */
export function addCoins(state: CollectionState, amount: number): CollectionState {
  return { ...state, coins: state.coins + amount };
}

/** NEWバッジを確認済みにする */
export function clearNewFlag(
  state: CollectionState,
  cardId: string
): CollectionState {
  const entry = state.owned[cardId];
  if (!entry || !entry.isNew) return state;
  return {
    ...state,
    owned: { ...state.owned, [cardId]: { ...entry, isNew: false } },
  };
}

/** すべてのNEWバッジを確認済みにする */
export function clearAllNewFlags(state: CollectionState): CollectionState {
  const owned: CollectionState['owned'] = {};
  for (const [cardId, entry] of Object.entries(state.owned)) {
    owned[cardId] = entry.isNew ? { ...entry, isNew: false } : entry;
  }
  return { ...state, owned };
}

/** 今日の日付(ログイン報酬の判定用) */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 1日1回のログイン報酬 */
export const DAILY_REWARD = 300;

/**
 * その日初めて開いた場合にコインを配る。
 * 配った場合は新しい state を、配らなかった場合は null を返す。
 */
export function claimDailyReward(
  state: CollectionState
): { state: CollectionState; amount: number } | null {
  const date = today();
  if (state.lastLoginDate === date) return null;
  return {
    state: { ...state, coins: state.coins + DAILY_REWARD, lastLoginDate: date },
    amount: DAILY_REWARD,
  };
}
