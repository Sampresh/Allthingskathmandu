'use client'

import { Chip } from '@/components/ui/Chip'

/** Status switcher for moderation queues. */
export function QueueTabs({ options, value, onChange }) {
  return (
    <div role="group" aria-label="Status" className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} selected={value === o} onClick={() => onChange(o)}>
          {o.charAt(0) + o.slice(1).toLowerCase()}
        </Chip>
      ))}
    </div>
  )
}
