'use client'

import { clsx } from 'clsx'
import { T } from '@/components/common/T'
import { formatTime12 } from '@/lib/format'
import { useClockValue } from '@/hooks/useClock'
import { WEEK, daySlots, nepalClock } from '@/lib/hours'

function slotText(slots) {
  if (!slots.length) return <T k="listing.closed" />
  if (slots.length === 1 && slots[0][0] === '00:00' && slots[0][1] === '24:00') {
    return <T k="listing.open24" />
  }
  return slots.map(([open, close]) => `${formatTime12(open)} – ${formatTime12(close)}`).join(', ')
}

/** Weekly hours in 12-hour Nepal time; today is highlighted once the browser knows the day. */
export function HoursTable({ hours }) {
  const today = useClockValue(() => nepalClock().day, null)

  return (
    <table className="w-full text-sm">
      <caption className="sr-only">
        <T k="listing.hours" />
      </caption>
      <tbody>
        {WEEK.map((day) => {
          const isToday = day === today
          return (
            <tr
              key={day}
              aria-current={isToday ? 'date' : undefined}
              className={clsx(
                'border-b border-border last:border-0',
                isToday && 'bg-brand/5 font-semibold',
              )}
            >
              <th scope="row" className="py-2.5 pr-4 pl-2 text-left font-normal">
                <span className={clsx(isToday && 'font-semibold')}>
                  <T k={`day.${day}`} />
                </span>
                {isToday && (
                  <span className="ml-2 rounded-pill bg-brand px-1.5 py-0.5 text-xs text-brand-contrast">
                    <T en="Today" ne="आज" />
                  </span>
                )}
              </th>
              <td className="py-2.5 pr-2 text-right tabular-nums">
                {slotText(daySlots(hours, day))}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
