'use client'

import { useEffect } from 'react'
import { Bilingual } from '@/components/common/Bilingual'
import { Button } from '@/components/ui/Button'
import { reportError } from '@/lib/reportError'

// Error boundaries load on every page, so they carry their own strings instead of the
// dictionary (Part 4 §9 JS budget).
const TEXT = {
  title: { en: 'Something went wrong', ne: 'केही गडबड भयो' },
  body: {
    en: 'We could not load this page. Please try again.',
    ne: 'यो पृष्ठ लोड गर्न सकिएन। फेरि प्रयास गर्नुहोस्।',
  },
  retry: { en: 'Try again', ne: 'फेरि प्रयास गर्नुहोस्' },
  home: { en: 'Home', ne: 'गृहपृष्ठ' },
}

export default function Error({ error, reset }) {
  useEffect(() => {
    reportError(error)
  }, [error])
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">
        <Bilingual entry={TEXT.title} />
      </h1>
      <p className="text-text-muted">
        <Bilingual entry={TEXT.body} />
      </p>
      <div className="flex gap-3">
        <Button onClick={() => reset()}>
          <Bilingual entry={TEXT.retry} />
        </Button>
        <Button href="/" variant="secondary">
          <Bilingual entry={TEXT.home} />
        </Button>
      </div>
    </main>
  )
}
