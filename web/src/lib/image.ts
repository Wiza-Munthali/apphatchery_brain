/**
 * Turning an uploaded logo into something safe to store.
 *
 * Avatars are persisted with the rest of the org state in localStorage, which
 * has a ~5MB budget for everything. An untouched phone photo would blow that on
 * its own, so every upload is cover-cropped to a small square and re-encoded
 * before it is ever put in state.
 */

/** Rejected before decoding — a guard against absurd inputs, not a quality bar. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024

/** Output edge length. Avatars render at 56px at most, so 256 covers retina. */
export const AVATAR_PX = 256

export class ImageError extends Error {}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new ImageError('That file couldn’t be read as an image.'))
    }
    img.src = url
  })
}

/**
 * Cover-crop to a centred square and re-encode.
 *
 * Returns a data URL. WebP is preferred for size; browsers that can't encode it
 * silently hand back a PNG from `toDataURL`, which is fine — we only check that
 * we got *something* back.
 */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new ImageError('Pick an image file (PNG, JPG, SVG or WebP).')
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageError('That image is larger than 8MB. Try a smaller one.')
  }

  const img = await loadImage(file)
  const side = Math.min(img.naturalWidth, img.naturalHeight)
  if (!side) throw new ImageError('That image appears to be empty.')

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_PX
  canvas.height = AVATAR_PX
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new ImageError('Your browser couldn’t process that image.')

  // Centre-crop the longer edge so logos aren't squashed.
  const sx = (img.naturalWidth - side) / 2
  const sy = (img.naturalHeight - side) / 2
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_PX, AVATAR_PX)

  const dataUrl = canvas.toDataURL('image/webp', 0.85)
  if (!dataUrl.startsWith('data:image/')) {
    throw new ImageError('Your browser couldn’t process that image.')
  }
  return dataUrl
}
