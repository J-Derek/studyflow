/** The largest centred square inside a picture of the given size. */
export function cropBox(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.max(1, Math.min(width, height));
  return { sx: Math.floor((width - side) / 2), sy: Math.floor((height - side) / 2), side };
}

export const MAX_PICTURE_BYTES = 8 * 1024 * 1024;

/**
 * Turns a chosen picture into a small square JPEG (a few kilobytes) that is safe to keep on the device.
 * Rejects anything that is not an image, is very large, or cannot be decoded.
 */
export async function resizeImageToDataUrl(file: File, size = 192, quality = 0.85): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose a picture file.');
  if (file.size > MAX_PICTURE_BYTES) throw new Error('That picture is too large. Choose one under 8 MB.');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('That file could not be read as a picture.');
  }

  const { sx, sy, side } = cropBox(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot resize pictures.');
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close?.();
  return canvas.toDataURL('image/jpeg', quality);
}
