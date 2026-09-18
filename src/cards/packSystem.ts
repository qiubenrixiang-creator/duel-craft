/**
 * パックの排出処理。
 *
 * 【抽選の考え方】
 * まずレアリティを確率で決め、次にそのレアリティのカードから1枚選ぶ。
 *
 * ただし、パックに「そのレアリティのカードが1枚も無い」ことがある
 * (例: SECのカードをまだ作っていない)。その場合は、
 * 1つ下のレアリティへ順に繰り下げる。こうしないと排出できず開封が止まってしまう。
 *
 * また、最後の1枚は必ずR以上にしている。
 * 全部Nだけのパックだと開封の楽しみが薄いため。
 */

import type { Card, Rarity } from '../types/card';
import type { CardPack, PackResultCard } from '../types/collection';
import { RARITY_ORDER } from '../types/collection';
import { getCard } from './cardPool';

/** カードのレアリティを取得する(未設定ならN) */
export function rarityOf(card: Card | undefined): Rarity {
  return card?.rarity ?? 'N';
}

/**
 * レアリティを1つ抽選する。
 * rates の合計が1でなくても、比率として正しく扱えるようにしている。
 */
function rollRarity(rates: Record<Rarity, number>): Rarity {
  const total = RARITY_ORDER.reduce((sum, r) => sum + (rates[r] ?? 0), 0);
  if (total <= 0) return 'N';

  let roll = Math.random() * total;
  for (const rarity of RARITY_ORDER) {
    roll -= rates[rarity] ?? 0;
    if (roll <= 0) return rarity;
  }
  return 'N';
}

/**
 * 指定レアリティのカードを、パックの収録内容から探す。
 * 該当が無ければ1つ下のレアリティへ繰り下げる。
 */
function pickCardOfRarity(
  pack: CardPack,
  pool: Card[],
  wanted: Rarity
): { card: Card; rarity: Rarity } | null {
  const startIndex = RARITY_ORDER.indexOf(wanted);

  // 希望のレアリティから順に下げながら探す
  for (let i = startIndex; i >= 0; i--) {
    const rarity = RARITY_ORDER[i];
    const candidates = pack.cardIds
      .map((id) => getCard(pool, id))
      .filter((c): c is Card => Boolean(c) && rarityOf(c) === rarity);

    if (candidates.length > 0) {
      const card = candidates[Math.floor(Math.random() * candidates.length)];
      return { card, rarity };
    }
  }

  // 下位が全滅した場合は、上位も含めて何でもよいので1枚返す
  const any = pack.cardIds
    .map((id) => getCard(pool, id))
    .filter((c): c is Card => Boolean(c));
  if (any.length === 0) return null;

  const card = any[Math.floor(Math.random() * any.length)];
  return { card, rarity: rarityOf(card) };
}

/** シークレット版が出る確率(そのカードがシークレット画像を持つ場合のみ) */
const SECRET_CHANCE = 0.08;

/** キラ仕様が出る確率(SR以上のみ) */
const FOIL_CHANCE = 0.25;

/**
 * パックを1つ開封する。
 *
 * @param ownedCardIds 既に所持しているカードのid。NEW判定に使う。
 */
export function openPack(
  pack: CardPack,
  pool: Card[],
  ownedCardIds: Set<string>
): PackResultCard[] {
  const results: PackResultCard[] = [];
  const seenInThisPack = new Set<string>();

  for (let i = 0; i < pack.cardsPerPack; i++) {
    const isLastCard = i === pack.cardsPerPack - 1;

    let wanted = rollRarity(pack.rates);
    // 最後の1枚は必ずR以上にする(開封の楽しみを保つため)
    if (isLastCard && wanted === 'N') {
      wanted = 'R';
    }

    const picked = pickCardOfRarity(pack, pool, wanted);
    if (!picked) break;

    const { card, rarity } = picked;

    // シークレット版の判定(そのカードにシークレット画像がある場合のみ)
    const isSecret = Boolean(card.secretImage) && Math.random() < SECRET_CHANCE;

    // キラ仕様の判定(SR以上、またはカード側でfoilが指定されている場合)
    const highRarity = ['SR', 'VR', 'SEC'].includes(rarity);
    const isFoil = Boolean(card.foil) || (highRarity && Math.random() < FOIL_CHANCE);

    const isNew = !ownedCardIds.has(card.id) && !seenInThisPack.has(card.id);
    seenInThisPack.add(card.id);

    results.push({
      cardId: card.id,
      rarity,
      isSecret,
      isFoil,
      isNew,
    });
  }

  return results;
}

/** 10連分をまとめて開封する */
export function openTenPacks(
  pack: CardPack,
  pool: Card[],
  ownedCardIds: Set<string>
): PackResultCard[][] {
  // 引いたカードを順次「所持済み」に加えていく。
  // そうしないと、10連の中で同じカードが何度もNEW扱いになってしまう。
  const owned = new Set(ownedCardIds);
  const packs: PackResultCard[][] = [];

  for (let i = 0; i < 10; i++) {
    const result = openPack(pack, pool, owned);
    result.forEach((r) => owned.add(r.cardId));
    packs.push(result);
  }
  return packs;
}

/**
 * パックの収録内容を、レアリティごとに集計する。
 * パック図鑑での表示に使う。
 */
export function summarizePack(
  pack: CardPack,
  pool: Card[]
): Record<Rarity, Card[]> {
  const summary: Record<Rarity, Card[]> = {
    N: [],
    R: [],
    SR: [],
    VR: [],
    SEC: [],
  };

  for (const id of pack.cardIds) {
    const card = getCard(pool, id);
    if (!card) continue;
    summary[rarityOf(card)].push(card);
  }
  return summary;
}

/**
 * コンプリート率を求める(所持しているカードの割合)。
 * パック図鑑で「85% COMPLETE」のように表示する。
 */
export function completionRate(
  pack: CardPack,
  ownedCardIds: Set<string>
): number {
  if (pack.cardIds.length === 0) return 0;
  const ownedCount = pack.cardIds.filter((id) => ownedCardIds.has(id)).length;
  return Math.round((ownedCount / pack.cardIds.length) * 100);
}
