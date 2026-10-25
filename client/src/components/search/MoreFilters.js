'use client'

import { T } from '@/components/common/T'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Dialog } from '@/components/ui/Dialog'
import { Select } from '@/components/ui/Select'
import { useT } from '@/hooks/useLang'
import { priceLevelText } from '@/lib/format'

const toggle = (list, value) =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

/** "More filters" sheet: Price and Rating. Loaded when first opened. */
export default function MoreFilters({ open, onClose, filters, set }) {
  const t = useT()
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('filters.more')}
      variant="sheet"
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => set({ price: [], rating: '' })}>
            <T k="filters.clear" />
          </Button>
          <Button onClick={onClose} fullWidth>
            <T k="filters.apply" />
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">
            <T k="filters.price" />
          </legend>
          <div className="flex flex-wrap gap-2">
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
          </div>
        </fieldset>
        <Select
          label={<T k="filters.rating" />}
          value={filters.rating}
          onChange={(e) => set({ rating: e.target.value })}
        >
          <option value="">{t('filters.anyRating')}</option>
          {[4, 3].map((n) => (
            <option key={n} value={n}>
              {n} {t('filters.minRating')}
            </option>
          ))}
        </Select>
      </div>
    </Dialog>
  )
}
