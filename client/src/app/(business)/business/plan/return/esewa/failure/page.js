import { Button } from '@/components/ui/Button'

/** eSewa's failure_url. The unpaid attempt is closed by the hourly subscriptions job. */
export default function EsewaFailurePage() {
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Plan payment</h1>
      <section role="alert" className="flex flex-col gap-3 rounded-box border border-danger p-4">
        <h2 className="text-lg font-semibold text-danger">Payment not completed</h2>
        <p>The eSewa payment was cancelled or did not go through. No plan was activated.</p>
        <div className="flex flex-wrap gap-2">
          <Button href="/business/plan" variant="secondary">
            Back to plan
          </Button>
        </div>
      </section>
    </div>
  )
}
