'use client'

import { useEffect } from 'react'
import { reportError } from '@/lib/reportError'
import '@/styles/globals.css'

// Replaces the root layout when it fails, so it brings its own <html> and plain strings.
export default function GlobalError({ error, reset }) {
  useEffect(() => {
    reportError(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-text-muted">We could not load this page. Please try again.</p>
          <div>
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex min-h-11 items-center rounded-box bg-brand px-4 font-semibold text-brand-contrast"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
