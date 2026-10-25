import { AccountT as T } from '@/components/common/AccountT'

/** A titled block of the account pages. */
export function Section({ titleKey, tone, children }) {
  return (
    <section
      className={`flex flex-col gap-4 rounded-box border p-4 ${tone === 'danger' ? 'border-danger' : 'border-border'}`}
    >
      <h2 className="text-lg font-semibold">
        <T k={titleKey} />
      </h2>
      {children}
    </section>
  )
}
