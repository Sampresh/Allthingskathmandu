import { Card } from '@/components/ui/Card'
import { T } from './T'

/** Card shell shared by the auth pages. */
export function AuthCard({ titleKey, introKey, children }) {
  return (
    <Card className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          <T k={titleKey} />
        </h1>
        {introKey && (
          <p className="text-text-muted">
            <T k={introKey} />
          </p>
        )}
      </div>
      {children}
    </Card>
  )
}
