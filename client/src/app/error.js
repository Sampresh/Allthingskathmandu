'use client'

import { T } from '@/components/common/T'
import { Button } from '@/components/ui/Button'

export default function Error({ reset }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">
        <T k="error.title" />
      </h1>
      <p className="text-text-muted">
        <T k="error.body" />
      </p>
      <div className="flex gap-3">
        <Button onClick={() => reset()}>
          <T k="common.retry" />
        </Button>
        <Button href="/" variant="secondary">
          <T k="common.home" />
        </Button>
      </div>
    </main>
  )
}
