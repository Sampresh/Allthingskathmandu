'use client'

import { LocateFixed } from 'lucide-react'
import { T } from '@/components/common/T'
import { Chip } from '@/components/ui/Chip'
import { Select } from '@/components/ui/Select'
import { useLang, useT } from '@/hooks/useLang'
import { priceLevelText } from '@/lib/format'
import { EMPTY_FILTERS, toggle } from './FilterBar'

function Group({ title, children }) {
  return (
    <fieldset className="flex flex-col gap-2 border-t border-border pt-4">
      <legend className="float-left mb-2 w-full text-sm font-semibold">{title}</legend>
      <div className="clear-both flex flex-wrap gap-2">{children}</div>
    </fieldset>
  )
}

/**
 * Desktop filter column: the same filters as FilterBar and its sheet, always in view. Loaded
 * apart from the page, so its text and controls stay out of the first-load JS budget.
 */
export default function FilterPanel({ tags, areas, filters, onChange, near }) {
  const t = useT()
  const lang = useLang()
  const set = (patch) => onChange({ ...filters, ...patch })
  const name = (item) => (lang === 'ne' && item.nameNe) || item.nameEn
  const nearOn = near.status === 'ready'

  return (
    <div className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          <T en="Filters" ne="फिल्टर" />
        </h2>
        <button
          type="button"
          onClick={() => {
            onChange(EMPTY_FILTERS)
            if (nearOn) near.clear()
          }}
          className="min-h-11 rounded-box px-2 text-sm font-semibold text-text-muted hover:text-text"
        >
          <T en="Reset" ne="रिसेट" />
        </button>
      </div>
      <Select
        label={<T en="Location" ne="स्थान" />}
        value={filters.area}
        onChange={(e) => set({ area: e.target.value })}
      >
        <option value="">{t('search.allAreas')}</option>
        {areas.map((a) => (
          <option key={a.slug} value={a.slug}>
            {name(a)}
          </option>
        ))}
      </Select>
      <Group title={<T en="Show" ne="देखाउनुहोस्" />}>
        <Chip selected={filters.open} onClick={() => set({ open: !filters.open })}>
          <T k="filters.openNow" />
        </Chip>
        <Chip selected={nearOn} onClick={nearOn ? near.clear : near.locate}>
          <LocateFixed aria-hidden="true" className="size-4" />
          <T k="filters.nearMe" />
        </Chip>
      </Group>
      {near.status === 'denied' && (
        <p className="text-sm text-text-muted" role="status">
          <T k="geo.denied" />
        </p>
      )}
      <Group title={<T k="filters.price" />}>
        {[1, 2, 3, 4].map((level) => (
          <Chip
            key={level}
            selected={filters.price.includes(level)}
            onClick={() => set({ price: toggle(filters.price, level) })}
            aria-label={`${t('listing.priceLevel')} ${level} ${t('listing.of4')}`}
          >
            {priceLevelText(level)}
          </Chip>
        ))}
      </Group>
      <Group title={<T k="filters.rating" />}>
        {[4, 3].map((n) => (
          <Chip
            key={n}
            selected={filters.rating === String(n)}
            onClick={() => set({ rating: filters.rating === String(n) ? '' : String(n) })}
          >
            {n}+<span className="sr-only"> {t('filters.minRating')}</span>
          </Chip>
        ))}
      </Group>
      {tags.length > 0 && (
        <Group title={<T en="Features" ne="विशेषता" />}>
          {tags.map((tag) => (
            <Chip
              key={tag.slug}
              selected={filters.tags.includes(tag.slug)}
              onClick={() => set({ tags: toggle(filters.tags, tag.slug) })}
            >
              <T en={tag.nameEn} ne={tag.nameNe} />
            </Chip>
          ))}
        </Group>
      )}
    </div>
  )
}
