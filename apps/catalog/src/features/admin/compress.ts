const MAX_SIDE = 1600;
const MAX_BYTES = 300 * 1024;

/** Reduce a ~1600 px y WebP (<300 KB si se puede). Cae a JPEG si el navegador no soporta WebP. */
export async function compressImage(file: File): Promise<{ blob: Blob; ext: 'webp' | 'jpg' }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const toBlob = (type: string, q: number) =>
    new Promise<Blob | null>((res) => canvas.toBlob(res, type, q));

  let type = 'image/webp';
  let blob = await toBlob(type, 0.85);
  if (!blob || blob.type !== type) {
    type = 'image/jpeg';
    blob = await toBlob(type, 0.85);
  }
  if (!blob) throw new Error('No se pudo procesar la imagen');
  for (let q = 0.75; blob.size > MAX_BYTES && q >= 0.5; q -= 0.1) {
    blob = (await toBlob(type, q)) ?? blob;
  }
  return { blob, ext: type === 'image/webp' ? 'webp' : 'jpg' };
}
