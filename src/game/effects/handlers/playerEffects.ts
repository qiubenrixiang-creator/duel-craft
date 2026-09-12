/**
 * プレイヤー(自分または相手)を対象とする効果。
 *
 * どの効果も、何も起きなかった場合に必ずその理由をログに残す。
 * 「発動したのに画面が何も変わらず、成功したのか分からない」状態を避けるため。
 */

import type { EffectHandler } from '../effectContext';
import { resolveTargetPlayer } from '../effectContext';
import { blankInstance } from '../../engine/evolutionSystem';
import { getCard } from '../../../cards/cardPool';

/** カードを引く。山札が尽きた場合、引けなかったプレイヤーの敗北。 */
export const drawHandler: EffectHandler = (ctx) => {
  const { player, playerSeat } = resolveTargetPlayer(ctx);

  for (let i = 0; i < ctx.value; i++) {
    if (player.deck.length === 0) {
      ctx.state.winner = playerSeat === 'p1' ? 'p2' : 'p1';
      ctx.log(`${player.name} は山札が0枚で引けず、敗北した。`);
      return;
    }
    const drawn = player.deck.shift();
    if (drawn) player.hand.push(drawn);
  }
  ctx.log(`${player.name} がカードを${ctx.value}枚引いた。`);
};

/** 手札をランダムに捨てる */
export const discardHandler: EffectHandler = (ctx) => {
  const { player } = resolveTargetPlayer(ctx);

  let discarded = 0;
  for (let i = 0; i < ctx.value && player.hand.length > 0; i++) {
    const idx = Math.floor(Math.random() * player.hand.length);
    const [card] = player.hand.splice(idx, 1);
    player.graveyard.push(card);
    discarded++;
  }

  if (discarded > 0) ctx.log(`${player.name} が手札を${discarded}枚捨てた。`);
  else ctx.log(`${player.name} の手札が無く、何も捨てられなかった。`);
};

/** 山札の上からシールドを追加する */
export const addShieldHandler: EffectHandler = (ctx) => {
  const { player } = resolveTargetPlayer(ctx);

  let added = 0;
  for (let i = 0; i < ctx.value && player.deck.length > 0; i++) {
    const card = player.deck.shift();
    if (card) player.shields.push(card);
    added++;
  }

  if (added > 0) ctx.log(`${player.name} のシールドが${added}枚増えた。`);
  else ctx.log(`${player.name} の山札が無く、シールドは増えなかった。`);
};

/**
 * 山札の上からマナゾーンに置く(マナ加速)。
 * 多色カードはタップして置かれる(総合ルール405.1)。
 */
export const manaAccelHandler: EffectHandler = (ctx) => {
  const { player } = resolveTargetPlayer(ctx);

  let moved = 0;
  for (let i = 0; i < ctx.value && player.deck.length > 0; i++) {
    const card = player.deck.shift();
    if (!card) break;
    const def = getCard(ctx.pool, card.cardId);
    const multi = (def?.civilizations.length ?? 0) > 1;
    player.mana.push({ ...card, tapped: multi });
    moved++;
  }

  if (moved > 0) ctx.log(`${player.name} の山札の上から${moved}枚がマナゾーンに置かれた。`);
  else ctx.log(`${player.name} の山札が無く、マナゾーンには何も置かれなかった。`);
};

/** 墓地のクリーチャーをランダムに手札へ戻す */
export const reviveHandler: EffectHandler = (ctx) => {
  const player = ctx.state.players[ctx.seat];

  let revived = 0;
  for (let i = 0; i < ctx.value; i++) {
    const candidates = player.graveyard.filter((c) => {
      const def = getCard(ctx.pool, c.cardId);
      return def?.type === 'creature' || def?.type === 'evolution';
    });
    if (candidates.length === 0) break;

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    const idx = player.graveyard.findIndex((c) => c.instId === picked.instId);
    const [moved] = player.graveyard.splice(idx, 1);
    player.hand.push(blankInstance(ctx.makeInstId(), moved.cardId));
    revived++;
  }

  if (revived > 0) ctx.log(`${player.name} が墓地からクリーチャーを${revived}体手札に戻した。`);
  else ctx.log(`${player.name} の墓地に対象になるクリーチャーがおらず、何も戻らなかった。`);
};
