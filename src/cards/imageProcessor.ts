/**
 * カード画像の取り込み処理。
 *
 * 画像は外部ストレージを使わず、縮小したうえで Base64 としてカードデータに含める。
 * この方式なら追加の設定やサーバーが不要で、カードをそのまま相手と共有できる。
 *
 * ただし容量には注意が必要なため、ここで必ず縮小・圧縮を通す。
 * カード画像として表示される領域は小さいので、元画像が大きくても
 * 縮小して問題ない。
 */

/** 保存する画像の最大辺(px)。カード表示領域より少し大きめに取る。 */
const MAX_EDGE = 420;

/** JPEG品質。見た目と容量の兼ね合いでこの値にしている。 */
const QUALITY = 0.78;

/** 1枚あたりの目安上限(バイト)。これを超えたら警告する。 */
export const SIZE_WARN_THRESHOLD = 120_000;

export interface ProcessedImage {
  /** data:image/jpeg;base64,... 形式 */
  dataUrl: string;
  /** おおよそのバイト数 */
  bytes: number;
  width: number;
  height: number;
}

/** 受け付ける画像形式 */
export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * 選択された画像ファイルを、保存に適した形へ変換する。
 *
 * 元の縦横比は保ったまま、長辺が MAX_EDGE 以下になるよう縮小する。
 * (カードの比率に合わせて切り抜くと、意図しない部分が切れることがあるため、
 *  切り抜きはせず全体を収める)
 */
export async function processCardImage(file: File): Promise<ProcessedImage> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('PNG / JPEG / WebP のいずれかを選んでください。');
  }

  const bitmap = await loadImage(file);

  // 長辺を MAX_EDGE に収める倍率(拡大はしない)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('画像を処理できませんでした。');

  // 透過PNGを想定し、背景を白で塗ってからJPEGにする
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);

  return {
    dataUrl,
    bytes: estimateBytes(dataUrl),
    width,
    height,
  };
}

/** ファイルを画像として読み込む */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('画像を読み込めませんでした。'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('画像の形式が不正です。'));
      img.onload = () => resolve(img);
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Base64文字列のおおよそのバイト数を求める。
 * Base64は元データの約4/3の長さになる。
 */
function estimateBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  return Math.floor((base64.length * 3) / 4);
}

/** バイト数を読みやすい表記にする */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
