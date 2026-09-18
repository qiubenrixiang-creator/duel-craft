/**
 * 背景フィールドの定義。
 *
 * 画像素材は使わず、すべてCSSのグラデーションと図形だけで描いている。
 * (既存作品の画像・イラストを一切使わないため)
 *
 * 3層構造:
 *   sky  … 空・雲・夕焼け
 *   far  … 遠景(山・海・森など)
 *   near … 近景(地面)
 */

import type { FieldId } from '../types/ui';

export interface FieldDefinition {
  id: FieldId;
  label: string;
  /** 空の層 */
  sky: string;
  /** 遠景の層 */
  far: string;
  /** 遠景の高さ(画面比) */
  farHeight: string;
  /** 近景の層。空島のように地面が無い場合は null */
  near: string | null;
  nearHeight: string;
  /** この背景に合う天候演出 */
  weather: 'clouds' | 'motes' | 'leaves' | 'snow' | 'none';
}

export const FIELDS: FieldDefinition[] = [
  {
    id: 'plain',
    label: '草原',
    sky: 'linear-gradient(180deg,#7FC7F5 0%,#B6E3FA 45%,#E8F6E0 100%)',
    far:
      'radial-gradient(120% 100% at 20% 100%,#8FBF7A 0 60%,transparent 61%),' +
      'radial-gradient(120% 100% at 75% 100%,#7FB26B 0 55%,transparent 56%)',
    farHeight: '38%',
    near: 'linear-gradient(180deg,#9ED184,#6FAE5E)',
    nearHeight: '22%',
    weather: 'clouds',
  },
  {
    id: 'coast',
    label: '海岸',
    sky: 'linear-gradient(180deg,#5FB8EE 0%,#A8DEF6 50%,#F4E3C0 100%)',
    far: 'linear-gradient(180deg,#2E86C7,#4FB0E0)',
    farHeight: '34%',
    near: 'linear-gradient(180deg,#EBD9AE,#DCC591)',
    nearHeight: '18%',
    weather: 'clouds',
  },
  {
    id: 'mountain',
    label: '山岳',
    sky: 'linear-gradient(180deg,#6EA8E8 0%,#AFD4F2 55%,#DCEAF6 100%)',
    far:
      'linear-gradient(135deg,transparent 44%,#7C93B8 45%,#93A9C9 55%,transparent 56%),' +
      'linear-gradient(215deg,transparent 44%,#6E86AC 45%,#8698BC 55%,transparent 56%)',
    farHeight: '44%',
    near: 'linear-gradient(180deg,#8FA98C,#6E8A6C)',
    nearHeight: '20%',
    weather: 'clouds',
  },
  {
    id: 'flower',
    label: '花畑',
    sky: 'linear-gradient(180deg,#8FD0F5 0%,#CDEAF8 45%,#FBE7F0 100%)',
    far: 'radial-gradient(120% 100% at 50% 100%,#F2A9C4 0 55%,transparent 56%)',
    farHeight: '36%',
    near: 'linear-gradient(180deg,#EFB6CE,#A9CE85)',
    nearHeight: '22%',
    weather: 'motes',
  },
  {
    id: 'snow',
    label: '雪原',
    sky: 'linear-gradient(180deg,#9FC4E8 0%,#CFE2F2 50%,#EEF6FC 100%)',
    far: 'linear-gradient(135deg,transparent 45%,#C8DCEC 46%,#DDEBF6 56%,transparent 57%)',
    farHeight: '38%',
    near: 'linear-gradient(180deg,#F2F8FD,#DCE9F4)',
    nearHeight: '20%',
    weather: 'snow',
  },
  {
    id: 'autumn',
    label: '紅葉',
    sky: 'linear-gradient(180deg,#87BFE8 0%,#E9CFA0 55%,#F6E2C4 100%)',
    far:
      'radial-gradient(110% 100% at 25% 100%,#D9762F 0 55%,transparent 56%),' +
      'radial-gradient(110% 100% at 78% 100%,#C25A2A 0 50%,transparent 51%)',
    farHeight: '38%',
    near: 'linear-gradient(180deg,#C98F52,#A8703F)',
    nearHeight: '20%',
    weather: 'leaves',
  },
  {
    id: 'ruins',
    label: '古代遺跡',
    sky: 'linear-gradient(180deg,#6FA9D8 0%,#C6DCEA 50%,#E4D9C2 100%)',
    far:
      'linear-gradient(90deg,transparent 8%,#BCB29C 8% 13%,transparent 13% 24%,' +
      '#C6BCA6 24% 29%,transparent 29% 68%,#BCB29C 68% 73%,transparent 73% 85%,' +
      '#C6BCA6 85% 90%,transparent 90%)',
    farHeight: '40%',
    near: 'linear-gradient(180deg,#B9AE96,#94896F)',
    nearHeight: '18%',
    weather: 'motes',
  },
  {
    id: 'skyIsland',
    label: '空島',
    sky: 'linear-gradient(180deg,#5AA8E8 0%,#9BD0F2 40%,#F3D9E8 100%)',
    far:
      'radial-gradient(60% 44% at 22% 62%,#A9CE85 0 46%,transparent 47%),' +
      'radial-gradient(52% 40% at 74% 74%,#8FBF7A 0 44%,transparent 45%)',
    farHeight: '42%',
    near: null,
    nearHeight: '0%',
    weather: 'motes',
  },
];

export function getField(id: FieldId): FieldDefinition {
  return FIELDS.find((f) => f.id === id) ?? FIELDS[0];
}

/** ランダムに1つ選ぶ(試合開始時に使う) */
export function randomFieldId(): FieldId {
  return FIELDS[Math.floor(Math.random() * FIELDS.length)].id;
}
