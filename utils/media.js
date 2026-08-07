/**
 * Lagos Konect — client-side media compression
 * ============================================================
 * Shrinks images in the browser before they are uploaded, so storage fills up
 * far more slowly. A photo straight off a phone is often 3–8 MP and several
 * megabytes; almost none of that resolution survives being shown in a card or
 * an avatar, so it is wasted bytes in the bucket.
 *
 * The rules here are deliberately cautious:
 *   · only real raster photos are touched — GIF (animated) and SVG (vector)
 *     are passed through untouched, and so is anything that is not an image;
 *   · the output keeps the input's format (JPEG stays JPEG, PNG stays PNG,
 *     WebP stays WebP), so the server sees nothing it did not already accept —
 *     no risk of an upload being rejected for a format it does not expect;
 *   · if compression does not actually make the file smaller, the ORIGINAL is
 *     returned, so we never trade quality for nothing;
 *   · any failure at all falls back to the original file, so compression can
 *     never block or break an upload.
 *
 * Video is intentionally NOT transcoded here. Doing it in the browser needs
 * ffmpeg.wasm (a multi-megabyte download the CSP would block) or a canvas
 * recorder that silently drops the audio track — both worse than leaving a
 * phone's already-H.264-compressed clip alone.
 */

const DEFAULTS = {
  maxDim: 1600,     // longest edge — plenty for a full-width card or a hero
  quality: 0.82,    // JPEG/WebP quality; visually lossless at card sizes
};

/** Formats that must never be re-encoded (animation / vector / unknown). */
const PASS_THROUGH = new Set(['image/gif', 'image/svg+xml']);

/**
 * Returns a smaller File, or the original if it is not a compressible image,
 * or if compressing would not help.
 *
 * @param {File}   file
 * @param {{maxDim?: number, quality?: number}} [opts]
 * @returns {Promise<File>}
 */
export async function compressImage(file, opts = {}) {
  if (!file || typeof file.type !== 'string') return file;
  if (!file.type.startsWith('image/') || PASS_THROUGH.has(file.type)) return file;

  const { maxDim, quality } = { ...DEFAULTS, ...opts };

  // Keep the input's format so the server sees a type it already accepts. PNG
  // is re-encoded as PNG (quality is ignored for it, but the resize still
  // saves a lot); JPEG and WebP re-encode with the quality setting.
  const outType = ['image/jpeg', 'image/webp', 'image/png'].includes(file.type)
    ? file.type
    : 'image/jpeg';

  try {
    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale   = Math.min(1, maxDim / longest);
    const width   = Math.max(1, Math.round(bitmap.width  * scale));
    const height  = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, outType, quality)
    );

    // No blob, or it came out no smaller than the original: keep the original.
    if (!blob || blob.size >= file.size) return file;

    const ext  = outType === 'image/png' ? 'png' : outType === 'image/webp' ? 'webp' : 'jpg';
    const name = file.name ? file.name.replace(/\.[^.]+$/, '') + '.' + ext : 'upload.' + ext;

    return new File([blob], name, { type: outType, lastModified: Date.now() });
  } catch {
    // Unreadable image, no canvas, blocked toBlob — never break the upload.
    return file;
  }
}

/**
 * Convenience wrapper: compress only when the value is a real image File,
 * otherwise hand it straight back. Lets an upload path that may carry either a
 * photo or a video (chat attachments, for instance) call one function without
 * having to branch on the type itself.
 *
 * @param {File} file
 * @param {{maxDim?: number, quality?: number}} [opts]
 * @returns {Promise<File>}
 */
export async function compressIfImage(file, opts = {}) {
  return compressImage(file, opts);
}
