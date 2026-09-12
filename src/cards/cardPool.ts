/**
 * カードプール(作成済みカードの一覧)を扱うユーティリティ。
 *
 * ゲーム中に流れるのは CardInstance (実体)であり、その中には cardId しか入っていない。
 * 名前やパワーといった情報が必要なときは、ここでプールから Card (設計図)を引く。
 */

import type { Card, Civilization } from '../types/card';

/** cardId からカードの設計図を引く */
export function getCard(pool: Card[], cardId: string): Card | undefined {
  return pool.find((c) => c.id === cardId);
}

/**
 * カードが持つ文明の一覧を返す。
 * 2つ以上あれば多色カードとして扱われる。
 */
export function getCardCivilizations(card: Card | undefined): Civilization[] {
  if (!card) return [];
  return card.civilizations ?? [];
}

/** 多色カードかどうか(マナに置く時タップされるかの判定に使う) */
export function isMulticolor(card: Card | undefined): boolean {
  return getCardCivilizations(card).length > 1;
}

/** カードの代表色。枠の色などの表示に使う。 */
export function primaryCivilization(card: Card | undefined): Civilization {
  return getCardCivilizations(card)[0] ?? 'fire';
}

/** クリーチャーとして扱うカードか(通常クリーチャーと進化クリーチャー) */
export function isCreatureCard(card: Card | undefined): boolean {
  return card?.type === 'creature' || card?.type === 'evolution';
}
