import Link from 'next/link'
import { Phone } from 'lucide-react'
import { telHref } from '@/lib/format'
import { ST as T } from './ST'

const LINKS = [
  ['/about', 'footer.about'],
  ['/contact', 'footer.contact'],
  ['/terms', 'footer.terms'],
  ['/privacy', 'footer.privacy'],
  ['/refund', 'footer.refund'],
  ['/business', 'nav.listBusiness'],
]

/** Emergency numbers (from Settings), site links and social links. */
export function Footer({ settings }) {
  const emergency = settings?.emergency_numbers ?? []
  const social = (settings?.social_links ?? []).filter((s) => s?.url && s?.platform)

  return (
    <footer className="mt-12 border-t border-border bg-surface-raised pb-20 lg:pb-0">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 md:grid-cols-3">
        {emergency.length > 0 && (
          <section aria-labelledby="footer-emergency">
            <h2 id="footer-emergency" className="mb-3 font-semibold">
              <T k="footer.emergency" />
            </h2>
            <ul className="grid grid-cols-2 gap-2">
              {emergency.map(({ label, number }) => (
                <li key={number}>
                  <a
                    href={telHref(number)}
                    className="flex min-h-11 items-center gap-2 rounded-box border border-border bg-surface px-3 text-sm hover:bg-surface-raised"
                  >
                    <Phone aria-hidden="true" className="size-4 text-danger" />
                    <span>
                      {label} <span className="font-semibold">{number}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <nav aria-labelledby="footer-links">
          <h2 id="footer-links" className="sr-only">
            <T k="footer.links" />
          </h2>
          <ul className="flex flex-col">
            {LINKS.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="inline-flex min-h-11 items-center hover:underline">
                  <T k={label} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {social.length > 0 && (
          <section aria-labelledby="footer-social">
            <h2 id="footer-social" className="mb-3 font-semibold">
              <T k="footer.follow" />
            </h2>
            <ul className="flex flex-col">
              {social.map(({ platform, url }) => (
                <li key={url}>
                  <a
                    href={url}
                    rel="noopener noreferrer"
                    target="_blank"
                    className="inline-flex min-h-11 items-center hover:underline"
                  >
                    {platform}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <p className="mx-auto max-w-6xl px-4 pb-6 text-sm text-text-muted">
        © {new Date().getFullYear()} <T k="site.name" />
      </p>
    </footer>
  )
}
