/**
 * ゾーンごとの情報公開ルール。
 *
 * 長押しでゾーンの中身を見られる機能があるが、何でも見られてしまうと
 * ゲームが成立しなくなる。ここで「どこまで見てよいか」を一元管理する。
 *
 * 公式ルールでの扱い:
 *   - バトルゾーン … 公開(403)
 *   - マナゾーン   … 公開。いつでも見られる(405.2)
 *   - 墓地         … 公開
 *   - 手札         … 持ち主のみ(402.3)
 *   - シールド     … 非公開。持ち主も中身を見られない
 *   - 山札         … 非公開。順序も含めて見られない
 */

import type { Seat, ZoneId } from '../../types/game';

/** ゾーンの中身をどこまで見せるか */
export type Visibility =
  | 'public' // 両者が中身を見られる
  | 'ownerOnly' // 持ち主だけが中身を見られる
  | 'countOnly'; // 誰も中身を見られない(枚数のみ)

export const ZONE_VISIBILITY: Record<ZoneId, Visibility> = {
  battleZone: 'public',
  mana: 'public',
  graveyard: 'public',
  hand: 'ownerOnly',
  shields: 'countOnly',
  deck: 'countOnly',
};

export const ZONE_LABEL: Record<ZoneId, string> = {
  battleZone: 'バトルゾーン',
  mana: 'マナゾーン',
  graveyard: '墓地',
  hand: '手札',
  shields: 'シールド',
  deck: '山札',
};

/**
 * viewer が owner のそのゾーンの中身を見られるか。
 * 長押しで一覧を開いてよいかの判定に使う。
 */
export function canInspectZone(zone: ZoneId, viewer: Seat, owner: Seat): boolean {
  const visibility = ZONE_VISIBILITY[zone];
  if (visibility === 'public') return true;
  if (visibility === 'ownerOnly') return viewer === owner;
  return false; // countOnly は中身を見せない
}

/**
 * 長押しでの詳細表示に対応しているゾーンの一覧。
 * UI側はこれを見て「長押しできる」表示を出す。
 */
export const INSPECTABLE_ZONES: ZoneId[] = ['battleZone', 'mana', 'graveyard'];
