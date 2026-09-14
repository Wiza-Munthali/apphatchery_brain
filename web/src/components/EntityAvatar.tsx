/**
 * The avatar for an org or a project: an uploaded logo when there is one,
 * otherwise the gradient-and-initial tile.
 *
 * Every place that used to hand-roll that gradient `div` now renders this, so
 * uploading a logo takes effect everywhere at once.
 */
export function EntityAvatar({
  imageUrl,
  initial,
  color,
  size = 40,
  radius = 'lg',
  className = '',
  alt,
}: {
  imageUrl?: string
  initial: string
  /** Tailwind gradient class fragment, e.g. 'from-brand-orange to-brand-navy'. */
  color: string
  /** Edge length in px. */
  size?: number
  radius?: 'md' | 'lg' | 'xl' | '2xl'
  className?: string
  /** Accessible name when a logo is shown; omit for decorative use. */
  alt?: string
}) {
  const radiusClass = { md: 'rounded-md', lg: 'rounded-lg', xl: 'rounded-xl', '2xl': 'rounded-2xl' }[radius]
  const box = { width: size, height: size }

  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={alt ?? ''}
        style={box}
        className={`shrink-0 object-cover ${radiusClass} ${className}`}
      />
    )
  }

  return (
    <div
      style={{ ...box, fontSize: Math.max(11, Math.round(size * 0.4)) }}
      className={`flex shrink-0 items-center justify-center bg-gradient-to-br font-bold text-white ${color} ${radiusClass} ${className}`}
      aria-hidden={alt ? undefined : true}
      aria-label={alt}
      role={alt ? 'img' : undefined}
    >
      {initial}
    </div>
  )
}
