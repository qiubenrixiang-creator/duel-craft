/**
 * 収集要素に関する型定義。
 *
 * 【重要な設計方針】
 * パックで集めたカードは「お楽しみ要素」であり、対戦には影響しない。
 * デッキには作成済みのカードを自由に入れられる(所持していなくてもよい)。
 *
 * この方針により:
 *   - 既存の遊び方(自分でカードを作って対戦)を一切壊さない
 *   - 収集は純粋な楽しみとして成立する
 */

import type { Rarity } from './card';

/** レアリティの並び順(低い順) */
export const RARITY_ORDER: Rarity[] = ['N', 'R', 'SR', 'VR', 'SEC'];

export const RARITY_LABEL: Record<Rarity, string> = {
  N: 'ノーマル',
  R: 'レア',
  SR: 'スーパーレア',
  VR: 'ベリーレア',
  SEC: 'シークレット',
};

/** 一覧などで表示するレアリティ色 */
export const RARITY_COLOR: Record<Rarity, string> = {
  N: '#9AA6B8',
  R: '#4FB8F5',
  SR: '#FFD24A',
  VR: '#FF8A3D',
  SEC: '#B47BF5',
};

/**
 * パックの定義。
 * どのカードがどのレアリティ枠で出るかを決める。
 */
export interface CardPack {
  id: string;
  name: string;
  description: string;
  /** 1パックの価格(GC) */
  price: number;
  /** 1パックから出る枚数 */
  cardsPerPack: number;
  /**
   * 収録カードのid。
   * ここに含まれるカードだけが、このパックから排出される。
   */
  cardIds: string[];
  /** レアリティごとの排出率(合計が1になるようにする) */
  rates: Record<Rarity, number>;
  /** パックの見た目の色 */
  themeColor: string;
  builtin?: boolean;
}

/**
 * 1枚のカードの所持状況。
 * 通常版とシークレット版は別々に数える。
 */
export interface OwnedEntry {
  /** 通常版の所持枚数 */
  count: number;
  /** シークレット版の所持枚数 */
  secretCount: number;
  /** 初めて入手した時刻。NEWバッジの判定に使う。 */
  firstObtainedAt: number;
  /** NEWバッジを表示するか(確認したら false にする) */
  isNew: boolean;
}

/** 開封結果の1枚 */
export interface PackResultCard {
  cardId: string;
  rarity: Rarity;
  /** シークレット版として出たか */
  isSecret: boolean;
  /** キラ仕様か */
  isFoil: boolean;
  /** 初めて入手したカードか(NEW表示用) */
  isNew: boolean;
}

/** 1回の開封の記録 */
export interface PackOpenRecord {
  packId: string;
  openedAt: number;
  cards: PackResultCard[];
}

/**
 * 収集に関する保存データ。
 * localStorage に保存され、リロードしても消えない。
 */
export interface CollectionState {
  /** 所持通貨(GC) */
  coins: number;
  /** cardId -> 所持状況 */
  owned: Record<string, OwnedEntry>;
  /** 開封履歴。直近のものから順に保持する。 */
  history: PackOpenRecord[];
  /** 最後にログインした日(日次報酬の判定に使う) */
  lastLoginDate: string;
}

/** 初期状態。最初は少しコインを持っている。 */
export function createInitialCollection(): CollectionState {
  return {
    coins: 1000,
    owned: {},
    history: [],
    lastLoginDate: '',
  };
}

/** 通貨の表示名 */
export const CURRENCY_NAME = 'GC';
export const CURRENCY_FULL_NAME = 'Gold Craft';
