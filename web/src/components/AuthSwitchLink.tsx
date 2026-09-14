import { Link } from 'react-router-dom'

/**
 * The cross-navigation between the sign-in and sign-up screens.
 *
 * This is the only route between the two, so it has to be genuinely findable:
 * body-size rather than caption-size, semibold, and underlined, against a muted
 * lead-in so the actionable half is the part that stands out.
 */
export function AuthSwitchLink({ prompt, to, label }: { prompt: string; to: string; label: string }) {
  // `text-base`, not `text-sm`: Astryx's tailwind-theme remaps the Tailwind
  // text scale onto its own, where `sm` is 12px and `base` is 14px.
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-base">
      <span className="text-slate-500 dark:text-neutral-400">{prompt}</span>
      <Link
        to={to}
        className="font-semibold text-brand-navy underline decoration-2 underline-offset-2 transition-colors hover:text-brand-navy-dark dark:text-brand-orange dark:hover:text-brand-orange-dark"
      >
        {label}
      </Link>
    </div>
  )
}
