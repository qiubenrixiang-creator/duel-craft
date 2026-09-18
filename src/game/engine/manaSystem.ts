/**
 * マナの支払いに関する処理。
 *
 * 総合ルール112.2a の規定:
 *   コストを支払う際、まずカードが持つ文明それぞれにつき1枚ずつ、その文明を持つ
 *   マナゾーンのカードをタップして文明の支払いを満たす。
 *   1枚のマナで複数文明の支払いを同時に満たすことはできない。
 *   その後、残りのコスト分だけ好きなマナを追加でタップする。
 *
 * 例: 火/闇の多色でコスト6のカード
 *   → 火のマナ1枚 + 闇のマナ1枚 + 残り4枚(文明不問) が必要
 *
 * 「どのマナをどの文明の支払いに充てるか」は自明ではない。
 * 例えば火/闇の多色マナが1枚しかない場合、それを火に充てるか闇に充てるかで
 * 支払えるかどうかが変わる。そのため二部マッチング(Kuhn法)で
 * 「全文明を同時に満たす割り当てが存在するか」を厳密に判定している。
 */

import type { Card, CardInstance, Civilization } from '../../types/card';
import { getCard, getCardCivilizations } from '../../cards/cardPool';

/**
 * 必要な各文明に、それぞれ別のマナを1枚ずつ割り当てられるか判定する。
 * 割り当てられる場合は、使用するマナの instId の配列を返す。不可能なら null。
 *
 * (アルゴリズムは既存実装から変更していない。型を付けただけ。)
 */
function matchCivilizations(
  untappedMana: CardInstance[],
  pool: Card[],
  requiredCivs: Civilization[]
): string[] | null {
  /** manaInstId -> 割り当てられた文明 */
  const assigned = new Map<string, Civilization>();

  function augment(civ: Civilization, visited: Set<string>): boolean {
    for (const m of untappedMana) {
      if (visited.has(m.instId)) continue;
      const manaCard = getCard(pool, m.cardId);
      const manaCivs = getCardCivilizations(manaCard);
      if (!manaCivs.includes(civ)) continue;
      visited.add(m.instId);
      const current = assigned.get(m.instId);
      // このマナが未使用か、既に使っている文明を別のマナへ回せるなら、ここに割り当てる
      if (current === undefined || augment(current, visited)) {
        assigned.set(m.instId, civ);
        return true;
      }
    }
    return false;
  }

  for (const civ of requiredCivs) {
    if (!augment(civ, new Set<string>())) return null;
  }
  return [...assigned.keys()];
}

/**
 * コスト・文明ともに支払い可能かを判定し、可能ならタップすべきマナの
 * instId の配列(長さ = cost)を返す。支払い不可能なら null。
 */
export function computeManaPayment(
  manaZone: CardInstance[],
  pool: Card[],
  civilizations: Civilization[],
  cost: number
): string[] | null {
  const uniqueCivs = [...new Set(civilizations)];
  const untapped = manaZone.filter((m) => !m.tapped);

  // 枚数が足りない
  if (untapped.length < cost) return null;
  // 文明数がコストを超える場合は原理的に支払えない
  // (例: 3文明のカードをコスト2で出すことはできない)
  if (uniqueCivs.length > cost) return null;

  const matched = matchCivilizations(untapped, pool, uniqueCivs);
  if (!matched) return null;

  const matchedSet = new Set(matched);
  const remaining = cost - matched.length;
  const others = untapped.filter((m) => !matchedSet.has(m.instId));
  if (others.length < remaining) return null;

  const extra = others.slice(0, remaining).map((m) => m.instId);
  return [...matched, ...extra];
}

/** 支払い可能かどうかだけを判定する(表示用) */
export function canAffordCard(
  manaZone: CardInstance[],
  pool: Card[],
  civilizations: Civilization[],
  cost: number
): boolean {
  return computeManaPayment(manaZone, pool, civilizations, cost) !== null;
}

/**
 * コスト軽減を反映した実際の支払いコスト。
 * 軽減しても0未満にはならない。
 */
export function effectiveCost(card: Card, side?: 'creature' | 'spell'): number {
  if (card.type === 'twinpact' && side === 'spell') {
    return card.spellSide?.cost ?? 0;
  }
  const reduction = card.keywords.costReduction ?? 0;
  return Math.max(0, card.cost - reduction);
}

/**
 * 支払いプランに従ってマナをタップする。
 * manaZone を直接書き換えるため、呼び出し側で複製済みの状態を渡すこと。
 */
export function applyManaPayment(manaZone: CardInstance[], plan: string[]): void {
  for (const instId of plan) {
    const mana = manaZone.find((m) => m.instId === instId);
    if (mana) mana.tapped = true;
  }
}
