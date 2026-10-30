'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { LocateFixed, SlidersHorizontal } from 'lucide-react'
import { T } from '@/components/common/T'
import { Chip } from '@/components/ui/Chip'
import { Select } from '@/components/ui/Select'
import { useLang, useT } from '@/hooks/useLang'

const MoreFilters = dynamic(() => import('./MoreFilters'), { ssr: false })

export const EMPTY_FILTERS = { tags: [], area: '', open: false, price: [], rating: '' }

export const toggle = (list, value) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

/**
 * Category filters (Part 4 §3): tag chips, Area, Open now, and a "More filters" sheet with
 * Price and Rating. Also the Near me and List / Map controls.
 */
export function FilterBar({ tags, areas, filters, onChange, view, onView, near }) {
  const t = useT()
  const lang = useLang()
  const [sheet, setSheet] = useState(null)
  const set = (patch) => onChange({ ...filters, ...patch })
  const name = (item) => (lang === 'ne' && item.nameNe) || item.nameEn

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip selected={filters.open} onClick={() => set({ open: !filters.open })}>
          <T k="filters.openNow" />
        </Chip>
        {tags.map((tag) => (
          <Chip
            key={tag.slug}
            selected={filters.tags.includes(tag.slug)}
            onClick={() => set({ tags: toggle(filters.tags, tag.slug) })}
          >
            <T en={tag.nameEn} ne={tag.nameNe} />
          </Chip>
        ))}
        <Chip
          selected={near.status === 'ready'}
          onClick={near.status === 'ready' ? near.clear : near.locate}
        >
          <LocateFixed aria-hidden="true" className="size-4" />
          <T k="filters.nearMe" />
        </Chip>
        <Chip
          selected={Boolean(filters.price.length || filters.rating)}
          onClick={() => setSheet(true)}
        >
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          <T k="filters.more" />
        </Chip>
      </div>
      {near.status === 'denied' && (
        <p className="text-sm text-text-muted" role="status">
          <T k="geo.denied" />
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Select
          label={<T k="search.area" />}
          value={filters.area}
          onChange={(e) => set({ area: e.target.value })}
          className="min-w-44"
        >
          <option value="">{t('search.allAreas')}</option>
          {areas.map((a) => (
            <option key={a.slug} value={a.slug}>
              {name(a)}
            </option>
          ))}
        </Select>
        <div role="group" aria-label={t('filters.view')} className="flex gap-2">
          <Chip selected={view === 'list'} onClick={() => onView('list')}>
            <T k="filters.list" />
          </Chip>
          <Chip selected={view === 'map'} onClick={() => onView('map')}>
            <T k="filters.map" />
          </Chip>
        </div>
      </div>

      {sheet !== null && (
        <MoreFilters open={sheet} onClose={() => setSheet(false)} filters={filters} set={set} />
      )}
    </div>
  )
}
