/**
 * カードショップの店主「モノウル」のセリフ。
 *
 * RPGの武器屋のような、温かく迎えてくれる雰囲気を目指す。
 * 場面ごとに複数用意し、毎回同じことを言わないようにする。
 */

import type { Rarity } from '../types/card';

/** 配列からランダムに1つ選ぶ */
function pick(lines: string[]): string {
  return lines[Math.floor(Math.random() * lines.length)];
}

export const MONOURU_NAME = 'モノウル';

/** 入店時のあいさつ */
const GREETINGS = [
  'おっ、デュエリスト！今日もいいカード入ってるぞ！',
  'いらっしゃい。ゆっくり見ていってくれ。',
  'よく来たな。今日はどんなカードをお探しだい？',
  'おう、待ってたぜ。新しいパックが届いたところだ。',
];

/** 購入時 */
const ON_PURCHASE = [
  'まいどあり！いいカードが出るといいな。',
  'ほら、持っていきな。運を祈ってるぜ。',
  'ありがとよ。開けるのが楽しみだな！',
];

/** コインが足りない時 */
const NOT_ENOUGH = [
  'おっと、コインが足りないみたいだ。また今度な。',
  'すまないが、ツケはやってないんだ。',
  'もう少し貯めてから来てくれよ。待ってるぜ。',
];

/** 高レアが出た時 */
const ON_HIGH_RARITY = [
  'おいおい、とんでもないのが出たな！',
  'こいつは驚いた……滅多に見られないぞ、それは。',
  'いい引きだ！今日はツイてるな。',
];

/** シークレットが出た時 */
const ON_SECRET = [
  'な……シークレットだと？！長年店をやってるが、そう何度も見るもんじゃない。',
  'こいつは本物だ。大事にしてやってくれよ。',
];

/** カードを1枚も作っていない時 */
const NO_CARDS = [
  'おっと、まだカードを作ってないみたいだな。まずは自分の一枚を作ってきな。',
  'パックに入れるカードがまだ無いようだ。カード作成から始めてくれ。',
];

export function greeting(): string {
  return pick(GREETINGS);
}

export function onPurchase(): string {
  return pick(ON_PURCHASE);
}

export function onNotEnoughCoins(): string {
  return pick(NOT_ENOUGH);
}

export function onNoCards(): string {
  return pick(NO_CARDS);
}

/**
 * 開封結果に応じたひとこと。
 * 一番良かったカードに反応する。
 */
export function onOpenResult(rarities: Rarity[]): string {
  if (rarities.includes('SEC')) return pick(ON_SECRET);
  if (rarities.includes('VR') || rarities.includes('SR')) {
    return pick(ON_HIGH_RARITY);
  }
  return pick(ON_PURCHASE);
}

/** 日替わり報酬を渡す時 */
export function onDailyReward(amount: number): string {
  return `今日はよく来てくれたな。ほら、${amount}GC だ。取っておきな。`;
}
