import Link from 'next/link'

/** A number with a label; links when `href` is given. */
export function StatTile({ label, value, hint, href }) {
  const body = (
    <>
      <p className="text-sm text-text-muted">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
    </>
  )
  const box = 'flex flex-col gap-1 rounded-box border border-border bg-surface p-4'
  return href ? (
    <Link href={href} className={`${box} hover:bg-surface-raised`}>
      {body}
    </Link>
  ) : (
    <div className={box}>{body}</div>
  )
}
