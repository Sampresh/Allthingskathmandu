'use client'

import { Plus, Trash2 } from 'lucide-react'

const DAYS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
]
const ALL_DAY = ['00:00', '24:00']
const isAllDay = (slots) =>
  slots.length === 1 && slots[0][0] === ALL_DAY[0] && slots[0][1] === ALL_DAY[1]
export const emptyWeek = () => Object.fromEntries(DAYS.map(([d]) => [d, []]))

/**
 * Weekly opening hours in Nepal time: per day closed, open 24 hours, or up to four time
 * slots. A slot that closes before it opens runs past midnight (16:00 to 02:00 belongs to the
 * day it opens). `value` null = no hours.
 */
export function HoursEditor({ value, onChange }) {
  const week = value ?? emptyWeek()
  const setDay = (day, slots) => onChange({ ...week, [day]: slots })

  if (!value) {
    return (
      <button
        type="button"
        onClick={() => onChange(Object.fromEntries(DAYS.map(([d]) => [d, [['09:00', '18:00']]])))}
        className="inline-flex min-h-11 items-center gap-2 rounded-box border border-border px-4 text-sm font-semibold hover:bg-surface-raised"
      >
        <Plus aria-hidden="true" className="size-4" /> Add opening hours
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {DAYS.map(([day, label]) => {
        const slots = week[day] ?? []
        const allDay = isAllDay(slots)
        return (
          <fieldset key={day} className="flex flex-col gap-2 border-b border-border pb-3">
            <legend className="mb-1 flex w-full items-center justify-between gap-2 font-semibold">
              {label}
              <button
                type="button"
                onClick={() => onChange(Object.fromEntries(DAYS.map(([d]) => [d, slots])))}
                className="text-sm font-semibold text-brand"
              >
                Copy to all days
                <span className="sr-only"> from {label}</span>
              </button>
            </legend>
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={slots.length === 0}
                  onChange={(e) => setDay(day, e.target.checked ? [] : [['09:00', '18:00']])}
                />
                Closed
              </label>
              <label className="inline-flex min-h-11 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={allDay}
                  onChange={(e) => setDay(day, e.target.checked ? [ALL_DAY] : [['09:00', '18:00']])}
                />
                Open 24 hours
              </label>
            </div>
            {!allDay &&
              slots.map(([open, close], i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col text-sm">
                    Opens
                    <input
                      type="time"
                      value={open}
                      onChange={(e) =>
                        setDay(
                          day,
                          slots.map((s, j) => (j === i ? [e.target.value, s[1]] : s)),
                        )
                      }
                      className="min-h-11 rounded-box border border-text-muted bg-surface px-2"
                    />
                  </label>
                  <label className="flex flex-col text-sm">
                    Closes
                    <input
                      type="time"
                      value={close === '24:00' ? '00:00' : close}
                      onChange={(e) =>
                        setDay(
                          day,
                          slots.map((s, j) => (j === i ? [s[0], e.target.value] : s)),
                        )
                      }
                      className="min-h-11 rounded-box border border-text-muted bg-surface px-2"
                    />
                  </label>
                  {close !== '24:00' && close < open && (
                    <span className="min-h-11 content-center text-sm text-text-muted">
                      closes next day
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${label} slot ${i + 1}`}
                    onClick={() =>
                      setDay(
                        day,
                        slots.filter((_, j) => j !== i),
                      )
                    }
                    className="inline-flex size-11 items-center justify-center rounded-box hover:bg-surface-raised"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
              ))}
            {!allDay && slots.length > 0 && slots.length < 4 && (
              <button
                type="button"
                onClick={() => setDay(day, [...slots, ['14:00', '18:00']])}
                className="self-start text-sm font-semibold text-brand"
              >
                Add another time
              </button>
            )}
          </fieldset>
        )
      })}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => onChange(null)}
          className="inline-flex min-h-11 items-center rounded-box px-4 text-sm font-semibold text-danger hover:bg-surface-raised"
        >
          Remove opening hours
        </button>
      </div>
    </div>
  )
}
