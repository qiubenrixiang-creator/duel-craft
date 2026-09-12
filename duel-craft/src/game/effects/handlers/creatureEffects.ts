/**
 * クリーチャーを対象とする効果。
 *
 * 対象が0体だった場合も必ず理由をログに残す。
 */

import type { EffectHandler } from '../effectContext';
import { cardName, resolveCreatureTargets } from '../effectContext';
import { returnToHand, sendToGraveyard } from '../../engine/evolutionSystem';
import { getCard } from '../../../cards/cardPool';

/**
 * クリーチャーを破壊する。
 *
 * エスケープを持つ場合、墓地に置くかわりに自分のシールドを1枚手札に加える。
 * 進化・侵略で重なっているカードは、まとめて墓地に置かれる。
 */
export const destroyHandler: EffectHandler = (ctx) => {
  const targets = resolveCreatureTargets(ctx);
  if (targets.length === 0) {
    ctx.log('対象になるクリーチャーがいなかったため、何も破壊されなかった。');
    return;
  }

  for (const { creature, owner } of targets) {
    const def = getCard(ctx.pool, creature.cardId);
    const name = def?.name ?? 'クリーチャー';

    // エスケープ: 破壊を置き換える
    if (def?.keywords.escape && owner.shields.length > 0) {
      owner.battleZone.forEach((c) => {
        if (c.kind === 'gear' && c.equippedTo === creature.instId) c.equippedTo = null;
      });
      owner.battleZone = owner.battleZone.filter((c) => c.instId !== creature.instId);

      const idx = Math.floor(Math.random() * owner.shields.length);
      const [shield] = owner.shields.splice(idx, 1);
      owner.hand.push(shield);
      ctx.log(
        `「${name}」がエスケープ。破壊されるかわりにシールドを1枚手札に加えた(S・トリガーは使えない)。`
      );
      continue;
    }

    sendToGraveyard(owner, creature, ctx.makeInstId);
    ctx.log(`「${name}」が破壊された。`);
  }
};

/** パワーを増減する。効果は永続(そのクリーチャーが場を離れるまで)。 */
export const powerChangeHandler: EffectHandler = (ctx) => {
  const targets = resolveCreatureTargets(ctx);
  if (targets.length === 0) {
    ctx.log('対象になるクリーチャーがいなかったため、パワーは変化しなかった。');
    return;
  }

  const delta = ctx.effect.effect === 'powerUp' ? ctx.value : -ctx.value;
  for (const { creature } of targets) {
    creature.powerMod += delta;
  }
  const sign = delta >= 0 ? `+${delta}` : `${delta}`;
  ctx.log(`クリーチャー${targets.length}体のパワーが${sign}された。`);
};

/**
 * 手札に戻す。
 * 進化クリーチャーの場合は一番上のカードだけが戻り、
 * 下に重なっていたカードが場に残る(総合ルール801.4)。
 */
export const bounceHandler: EffectHandler = (ctx) => {
  const targets = resolveCreatureTargets(ctx);
  if (targets.length === 0) {
    ctx.log('対象になるクリーチャーがいなかったため、何も手札に戻らなかった。');
    return;
  }

  for (const { creature, owner } of targets) {
    const name = cardName(ctx.pool, creature.cardId);
    returnToHand(owner, creature, ctx.makeInstId);
    ctx.log(`「${name}」が手札に戻った。`);
  }
};

/** クリーチャーをマナゾーンに置く */
export const toManaHandler: EffectHandler = (ctx) => {
  // 対象がプレイヤーの場合は「山札の上からマナに置く」動作になるため、
  // そちらは playerEffects の manaAccelHandler が担当する。
  const isPlayerTarget =
    ctx.effect.target === 'self' || ctx.effect.target === 'opponent';
  if (isPlayerTarget) return;

  const targets = resolveCreatureTargets(ctx);
  if (targets.length === 0) {
    ctx.log('対象になるクリーチャーがいなかったため、何もマナゾーンに置かれなかった。');
    return;
  }

  for (const { creature, owner } of targets) {
    const def = getCard(ctx.pool, creature.cardId);
    const name = def?.name ?? 'クリーチャー';
    const multi = (def?.civilizations.length ?? 0) > 1;

    owner.battleZone.forEach((c) => {
      if (c.kind === 'gear' && c.equippedTo === creature.instId) c.equippedTo = null;
    });
    owner.battleZone = owner.battleZone.filter((c) => c.instId !== creature.instId);
    owner.mana.push({
      ...creature,
      instId: ctx.makeInstId(),
      understack: [],
      equippedTo: null,
      powerMod: 0,
      tapped: multi,
    });
    ctx.log(`「${name}」がマナゾーンに置かれた。`);
  }
};

/** タップする */
export const tapHandler: EffectHandler = (ctx) => {
  const targets = resolveCreatureTargets(ctx);
  if (targets.length === 0) {
    ctx.log('対象になるクリーチャーがいなかったため、何もタップされなかった。');
    return;
  }
  targets.forEach(({ creature }) => (creature.tapped = true));
  ctx.log(`クリーチャーを${targets.length}体タップした。`);
};

/** アンタップする */
export const untapHandler: EffectHandler = (ctx) => {
  const targets = resolveCreatureTargets(ctx);
  if (targets.length === 0) {
    ctx.log('対象になるクリーチャーがいなかったため、何もアンタップされなかった。');
    return;
  }
  targets.forEach(({ creature }) => (creature.tapped = false));
  ctx.log(`クリーチャーを${targets.length}体アンタップした。`);
};

/**
 * そのターン攻撃できなくする。
 * G・ストライクの効果として使われるほか、能力エディタからも指定できる。
 */
export const preventAttackHandler: EffectHandler = (ctx) => {
  const targets = resolveCreatureTargets(ctx);
  if (targets.length === 0) {
    ctx.log('対象になるクリーチャーがいなかったため、何も起こらなかった。');
    return;
  }
  targets.forEach(({ creature }) => (creature.cannotAttackThisTurn = true));
  ctx.log(`クリーチャー${targets.length}体が、このターン攻撃できなくなった。`);
};

/**
 * ブレイク数を増やす。
 * 常在能力としてのみ意味を持ち、パワー計算と同様に
 * 攻撃時に都度参照されるため、ここでは何もしない。
 */
export const addBreakerHandler: EffectHandler = (ctx) => {
  ctx.log('(常在)ブレイク数の増加は攻撃時に適用される。');
};
