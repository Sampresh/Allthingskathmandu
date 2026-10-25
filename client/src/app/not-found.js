import { ST as T } from '@/components/common/ST'
import { Button } from '@/components/ui/Button'

export const metadata = { title: 'Page not found', robots: { index: false } }

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">
        <T k="notFound.title" />
      </h1>
      <p className="text-text-muted">
        <T k="notFound.body" />
      </p>
      <div>
        <Button href="/">
          <T k="common.home" />
        </Button>
      </div>
    </main>
  )
}
