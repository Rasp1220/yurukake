// アップロード前にブラウザ側（canvas）で画像を縮小・JPEG化する。
//
// サーバー側（Vercelの関数）でリサイズ処理をすると、画像1枚ごとに計算リソースを
// 消費しコストや実行時間の制約にぶつかりやすいため、あえてアップロード前の
// クライアント側で完結させている。副次的に、canvasへ描画し直して書き出す
// ことでEXIF（撮影日時・位置情報など）も自動的に失われる。

const JPEG_QUALITY = 0.85;

async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  if (!file.type.startsWith("image/")) {
    throw new Error("画像ファイルを選択してください");
  }
  // imageOrientation: "from-image" で、EXIFの回転情報を先に反映してから
  // ビットマップ化する。そうしないと、EXIFを破棄した後に画像が横倒しに
  // なって見えることがある。
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

function canvasToJpegFile(canvas: HTMLCanvasElement, originalName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("画像の変換に失敗しました"));
          return;
        }
        const base = originalName.replace(/\.[^./\\]+$/, "");
        resolve(new File([blob], `${base || "image"}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
}

function createCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
} {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像の処理に失敗しました");
  // JPEGには透明度が無いため、透過PNGなどが黒背景にならないよう白で塗っておく。
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  return { canvas, ctx };
}

/**
 * プロフィール画像用：中央を正方形に切り抜き、指定サイズ（既定256x256）の
 * JPEGにリサイズする。
 */
export async function compressAvatarImage(file: File, size = 256): Promise<File> {
  const bitmap = await loadImageBitmap(file);
  try {
    const sourceSize = Math.min(bitmap.width, bitmap.height);
    const sourceX = (bitmap.width - sourceSize) / 2;
    const sourceY = (bitmap.height - sourceSize) / 2;

    const { canvas, ctx } = createCanvas(size, size);
    ctx.drawImage(bitmap, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);

    return await canvasToJpegFile(canvas, file.name);
  } finally {
    bitmap.close();
  }
}

/**
 * ブログのサムネイル・本文画像用：縦横比を保ったまま、縦横それぞれが
 * maxDimension（既定4096px）以下になるよう縮小したJPEGにする。
 * 元画像がそれ以下の場合は拡大しない。
 */
export async function compressContentImage(file: File, maxDimension = 4096): Promise<File> {
  const bitmap = await loadImageBitmap(file);
  try {
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const { canvas, ctx } = createCanvas(width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    return await canvasToJpegFile(canvas, file.name);
  } finally {
    bitmap.close();
  }
}
